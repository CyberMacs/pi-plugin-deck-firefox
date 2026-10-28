'use strict';
/* ChatGPT UI integration ONLY. No private network endpoints, no tokens/cookies. */

const COMPOSER_SELECTORS = [
  '#prompt-textarea',
  '[data-testid="prompt-textarea"]',
  '[data-testid="composer-text-input"]',
  '[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]',
  'textarea[placeholder]'
];

function visible(element) {
  if (!(element instanceof Element) || !element.getClientRects().length) return false;
  const style = getComputedStyle(element);
  return style.visibility !== 'hidden' && style.display !== 'none';
}
function findComposer() {
  for (const selector of COMPOSER_SELECTORS) {
    const found = [...document.querySelectorAll(selector)].find(visible);
    if (found) return found;
  }
  return null;
}
function placeCursorAtEnd(editor) {
  editor.focus();
  if ('setSelectionRange' in editor && typeof editor.setSelectionRange === 'function') {
    const len = editor.value.length;
    editor.setSelectionRange(len, len);
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}
function composerText(editor) {
  return 'value' in editor ? editor.value : (editor.innerText || editor.textContent || '');
}
function insertText(editor, text) {
  if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
    const original = editor.value;
    const prototype = editor.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    const position = editor.selectionStart ?? original.length;
    const end = editor.selectionEnd ?? position;
    if (set) set.call(editor, original.slice(0, position) + text + original.slice(end));
    else editor.value = original.slice(0, position) + text + original.slice(end);
    editor.setSelectionRange(position + text.length, position + text.length);
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    return true;
  }
  let ok = false;
  try { ok = document.execCommand('insertText', false, text); } catch (_) { /* no execCommand */ }
  if (!ok) return false;
  return true;
}
function norm(text) { return String(text || '').trim().replace(/^@/, '').replace(/\s+/g, ' ').toLocaleLowerCase(); }
function optionCandidates() {
  const menuRoots = [...document.querySelectorAll('[role="listbox"],[role="menu"],[cmdk-root],[data-radix-popper-content-wrapper]')].filter(visible);
  const selector = '[role="option"],[role="menuitem"],[cmdk-item],[data-testid*="suggestion"],button';
  const out = new Set();
  for (const root of menuRoots) {
    for (const el of root.querySelectorAll(selector)) if (visible(el)) out.add(el);
  }
  return [...out];
}
async function insertMention(name) {
  if (typeof name !== 'string' || !name.trim() || name.length > 110) return {ok:false, error:'Érvénytelen név.'};
  const editor = findComposer();
  if (!editor) return {ok:false, error:'Nem találom a ChatGPT beviteli mezőjét.'};
  const before = composerText(editor);
  const prefix = before && !/\s$/.test(before) ? ' ' : '';
  const mention = `@${name.replace(/^@+/, '')}`;
  placeCursorAtEnd(editor);
  if (!insertText(editor, prefix + mention)) return {ok:false, error:'A ChatGPT szerkesztő elutasította a beillesztést.'};
  if (!composerText(editor).includes(mention)) return {ok:false, error:'Nem tudtam visszaellenőrizni a beillesztést.'};

  // Best effort: select an exact plugin suggestion IF ChatGPT opened its @ picker.
  // A typed @name is not a semantic app mention unless ChatGPT itself accepts it.
  let picked = false;
  for (let attempt = 0; attempt < 4 && !picked; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 160));
    const candidate = optionCandidates().find(el => {
      const label = el.getAttribute('aria-label') || el.innerText || '';
      const firstLine = label.split('\n')[0];
      return norm(firstLine) === norm(name) || norm(label) === norm(name);
    });
    if (candidate) { candidate.click(); picked = true; }
  }
  return {ok:true, picked};
}

/*
 * Directory scanner, v0.2.3.
 * No private endpoints, cookies, chat messages, or off-site traffic.
 * Scan only the user-opened /plugins directory DOM. Inferred titles are
 * returned with confidence for human review, never silently imported.
 */
const pluginHref = /(?:\/plugins\/(?!\?|$)[^/?#]+|\/g\/g-[^/?#]+|\/apps?\/(?!\?|$)[^/?#]+)/i;
const uiLabels = /^(?:plugins?|my plugins|your plugins|personal|created by (?:you|me)|my creations|saját(?: pluginok)?|általam létrehozott(?:ak)?|installed|telepített(?:ek)?|telepítve|shared with me|megosztva velem|search|search plugins|keresés|categories|category|kategóriák|kategória|all|összes|browse|discover|manage|create|create plugin|new plugin|add plugin|refresh|frissítés|openai|more|see all|show all|view all|filters|filter|clear filters|sort|settings|beállítások|learn more|edit|szerkesztés|publish|publikálás|duplicate|export|import|about|privacy policy|updated|no plugins|nincs plugin|try again|back|vissza|next|következő|previous|előző|load more|created by you|created by me|install plugin|uninstall|install|uninstall plugin)$/i;
const actionLine = /^(?:installed|uninstalled|edit|delete|remove|open|share|install|configure|published|draft|private|public|view details|learn more|preview|created|connect|connected|updated|install plugin|see details|created by .+|by .+|telepítve|szerkesztés|törlés|megosztás)$/i;

function cleanName(value) {
  return String(value || '').replace(/^\s*@/, '').replace(/[\u200b-\u200f\ufeff]/g,'')
    .replace(/\s+/g, ' ').trim();
}
function validName(value) {
  const name = cleanName(value);
  return name.length >= 2 && name.length <= 110 && !uiLabels.test(name) && !actionLine.test(name) &&
    !/^(?:\d+\s*(?:plugins?|results?|találat|eredmény)|https?:\/\/|\S+@\S+\.\S+)/i.test(name) &&
    !/[{}<>]/.test(name) && !/[.!?]\s+.+[.!?]/.test(name) && !/^\d+$/.test(name);
}
function pageMode() {
  if (location.pathname.replace(/\/$/, '') !== '/plugins') return null;
  const params = new URLSearchParams(location.search);
  const personal = params.get('directoryTab') === 'personal';
  if (personal && params.get('category') === 'plugins-created-by-you') return 'created';
  if (personal) return 'personal';
  if (params.get('directoryTab') === 'installed' || params.get('category') === 'installed') return 'installed';
  return null;
}
function mainScope() {
  return document.querySelector('main,[role="main"]') || document.body;
}
function suitable(el, scope) {
  if (!visible(el) || !scope.contains(el)) return false;
  return !el.closest('nav,aside,footer,header,[role="navigation"],[role="dialog"],[role="menu"],[role="tablist"],script,style');
}
function elementText(el) {
  return String(el?.innerText || '').trim();
}
function titleLines(element) {
  return elementText(element).split(/\r?\n+/).map(cleanName).filter(Boolean).slice(0, 12);
}
function labeledTitle(card) {
  const selectors = [
    '[data-testid*="plugin-name" i],[data-testid*="plugin-title" i],[data-testid*="card-title" i]',
    'h2,h3,h4,h5,h6,[role="heading"]',
    '[data-testid*="title" i],[data-testid*="name" i]',
    '[class*="font-semibold"],[class*="font-medium"],[class*="font-bold"],[class*="text-foreground"]',
    '[title],[aria-label]'
  ];
  for (const selector of selectors) {
    for (const el of card.querySelectorAll(selector)) {
      if (!visible(el)) continue;
      const value = el.matches('[title],[aria-label]') ?
        el.getAttribute('title') || el.getAttribute('aria-label') : elementText(el);
      const first = String(value || '').split(/\r?\n/)[0];
      if (validName(first)) return cleanName(first);
    }
  }
  return '';
}
function chooseTileName(tile) {
  const semantic = labeledTitle(tile);
  if (semantic) return semantic;
  const lines = titleLines(tile);
  // Many ChatGPT cards consist only of div/span elements, with first line as title.
  // Avoid admitting a long prose line as a plugin name.
  for (const line of lines.slice(0, 4)) {
    if (validName(line) && line.length <= 85 && line.split(' ').length <= 12) return line;
  }
  return '';
}
function titleLike(el) {
  if (!visible(el)) return false;
  const t = cleanName(elementText(el));
  if (!validName(t) || t.length > 85 || t.includes('\n')) return false;
  const style = getComputedStyle(el);
  const weight = Number(style.fontWeight) || (/(bold|semibold|medium)/i.test(style.fontWeight) ? 600 : 400);
  return weight >= 500 || el.matches('h2,h3,h4,h5,h6,[role="heading"],strong,b');
}
function groupIdentity(element) {
  const classes = (typeof element.className === 'string' ? element.className : '').split(/\s+/).filter(Boolean);
  const significant = classes.filter(c => /(?:card|rounded|border|flex|grid|group|item|hover|cursor)/i.test(c)).slice(0, 5).join('.');
  return `${element.tagName}:${significant}:${element.getAttribute('role') || ''}`;
}
function inspectRepeatingGroups(scope, add, stats) {
  const parents = scope.querySelectorAll('section,ul,ol,div,[role="list"],[role="grid"]');
  const usedGroups = new Set();
  for (const parent of parents) {
    if (!suitable(parent, scope) || usedGroups.has(parent)) continue;
    const children = [...parent.children].filter(el => suitable(el, scope));
    if (children.length < 2 || children.length > 120) continue;
    const groups = new Map();
    for (const child of children) {
      const rect = child.getBoundingClientRect();
      const txt = elementText(child);
      if (rect.width < 85 || rect.height < 16 || txt.length < 3 || txt.length > 800) continue;
      const key = groupIdentity(child);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(child);
    }
    for (const group of groups.values()) {
      if (group.length < 2 || group.length > 80) continue;
      // A repeating collection is much stronger evidence than a random bold text.
      const names = group.map(chooseTileName);
      const plausible = names.filter(validName);
      if (plausible.length < 2 || plausible.length / group.length < 0.6) continue;
      // Reject repeated controls whose names are identical (e.g. edit buttons).
      if (new Set(plausible.map(n => n.toLocaleLowerCase())).size < 2) continue;
      stats.groups++;
      usedGroups.add(parent);
      for (let idx=0; idx<group.length; idx++) {
        if (validName(names[idx])) add(names[idx], 2, 'ismétlődő kártya');
      }
    }
  }
}
/*
 * Created-by-you fallback based on the ACTUAL October 2026 diagnostic:
 * 217 main visible lines = 5 UI labels + 106 alternating title/description lines.
 * The 106 clickable anchors contain no readable text, so anchor/card scanners
 * cannot extract names. The following matcher requires a known list heading,
 * repeated title/description pairs, and cross-checks the anchor count when
 * links exist. All results need user confirmation; nothing auto-imports.
 */
function scanCreatedTextPairs(scope) {
  const lines = elementText(scope).split(/\r?\n+/).map(cleanName).filter(Boolean);
  const markers = /^(?:bővítmények keresése|bovitmenyek keresese|search plugins|search for plugins|search extensions|search apps)$/i;
  let anchor = -1;
  for (let i = 0; i < lines.length; i++) if (markers.test(lines[i])) anchor = i;
  if (anchor < 0) return {names:[], count:0, reason:'Nincs pluginlista-keresőcímke'};
  const tail = lines.slice(anchor + 1);
  const totalPairs = Math.floor(tail.length / 2);
  if (totalPairs < 5 || totalPairs > 200) return {names:[], count:totalPairs, reason:'Valószínűtlen párosszám'};

  const pairs = [];
  for (let i = 0; i < totalPairs; i++) {
    const title = tail[i * 2];
    const description = tail[i * 2 + 1];
    if (!validName(title) || !description || description.length < 7 ||
        uiLabels.test(description) || title.toLocaleLowerCase() === description.toLocaleLowerCase()) continue;
    pairs.push({title, description});
  }
  // A visible-lines ordering is trusted only if most entries form valid pairs.
  if (pairs.length / totalPairs < 0.90) return {names:[], count:totalPairs, reason:'Nem következetes a név/leírás ritmus'};
  // In the reported actual UI: 106 links and 106 pairs. This is a second check
  // to avoid guessing on generic listing pages or unrelated UI text.
  const directoryLinks = [...scope.querySelectorAll('a[href]')]
    .filter(el => suitable(el, scope) && pluginHref.test(el.getAttribute('href') || '')).length;
  if (directoryLinks && Math.abs(directoryLinks - totalPairs) > Math.max(3, Math.ceil(directoryLinks * 0.12)))
    return {names:[], count:totalPairs, reason:`Hivatkozásszám eltér: ${directoryLinks}`};
  // Unexpected unpaired row likely indicates a changed UI. Reject rather than
  // misalign everything; one trailing UI label is permitted.
  if (tail.length % 2 && !uiLabels.test(tail[tail.length - 1]))
    return {names:[], count:totalPairs, reason:'Pár nélküli zárósor'};
  return {names:pairs.map(pair => pair.title), count:totalPairs, reason:'Felismert név/leírás párok'};
}

function scanDirectory() {
  const mode = pageMode();
  if (!mode) return {names:[], suggested:[], mode:'other', inspected:0, note:'Nyisd meg a Created by you oldalt.'};
  const scope = mainScope();
  const candidates = new Map();
  const stats = { inspected:0, groups:0, linked:0, headings:0, fallback:0, textPairs:0, textPairStatus:'' };
  function add(value, confidence, evidence) {
    const name = cleanName(value);
    if (!validName(name)) return;
    const key = name.toLocaleLowerCase();
    const prev = candidates.get(key);
    if (!prev || confidence > prev.confidence) candidates.set(key, {name, confidence, evidence});
  }
  const explicitCard = 'article,[role="listitem"],[data-testid*="plugin-card" i],[data-testid*="app-card" i],[data-testid*="marketplace-card" i],[data-testid*="plugin-item" i],[data-testid*="card" i]';
  for (const card of scope.querySelectorAll(explicitCard)) {
    if (!suitable(card, scope)) continue;
    stats.inspected++;
    const name = chooseTileName(card);
    if (name) add(name, 3, 'kártyacím');
  }
  for (const anchor of scope.querySelectorAll('a[href]')) {
    if (!suitable(anchor, scope) || !pluginHref.test(anchor.getAttribute('href') || '')) continue;
    stats.inspected++; stats.linked++;
    const name = chooseTileName(anchor) || anchor.getAttribute('aria-label');
    if (name) add(name, 3, 'pluginhivatkozás');
  }
  for (const el of scope.querySelectorAll('h2,h3,h4,h5,h6,[role="heading"],[data-testid*="plugin-name" i],[data-testid*="plugin-title" i]')) {
    if (!suitable(el, scope)) continue;
    stats.inspected++; stats.headings++;
    if (titleLike(el)) add(elementText(el), 2, 'címke');
  }
  inspectRepeatingGroups(scope, add, stats);
  if (mode === 'created') {
    const parsed = scanCreatedTextPairs(scope);
    stats.textPairStatus = parsed.reason;
    stats.textPairs = parsed.names.length;
    if (parsed.names.length >= 5) {
      // Pair-validated collection is more precise than a generic card guess:
      // discard accidental matches to descriptions and rely on the titles.
      candidates.clear();
      for (const title of parsed.names) add(title, 2, 'Created by you: név/leírás páros');
    }
  }
  // Low-confidence fallback: title styled as generic div/span inside a grid card.
  // These names are never added without explicit preview approval.
  if (candidates.size === 0) {
    for (const el of scope.querySelectorAll('strong,b,div,span,p')) {
      if (!suitable(el, scope) || el.children.length > 1 || !titleLike(el)) continue;
      const container = el.closest('article,[role="listitem"],a,button,[role="button"]') || el.parentElement?.parentElement;
      if (!container || !suitable(container, scope)) continue;
      const body = elementText(container);
      if (body.length < elementText(el).length + 5 || body.length > 600) continue;
      stats.inspected++; stats.fallback++;
      add(elementText(el), 1, 'kiemelt szöveg');
    }
  }
  const suggested = [...candidates.values()].sort((a,b) => b.confidence - a.confidence || a.name.localeCompare(b.name,'hu')).slice(0,200);
  return { names: suggested.map(x => x.name), suggested, mode, inspected:stats.inspected, stats,
    needsReview: suggested.some(x => x.confidence < 3),
    note: mode === 'created' ? 'Created by you nézetből kiolvasott javaslatok.' : `${mode} nézetből kiolvasott javaslatok.` };
}
function scanDebug() {
  // Only derived UI structure & very short visible labels from /plugins, never DOM HTML,
  // cookies, API responses or other ChatGPT pages. Review before sharing.
  const mode = pageMode();
  if (!mode) return {ok:false, message:'Nem a ChatGPT /plugins oldalán vagy.'};
  const scope = mainScope();
  const result = scanDirectory();
  const rootLines = elementText(scope).split(/\n+/).map(cleanName).filter(Boolean);
  const briefLines = rootLines.slice(0, 100).map(x => x.slice(0, 110));
  const cardSamples = [...scope.querySelectorAll('a,article,button,[role="button"],[role="listitem"],h2,h3,h4')]
    .filter(el => suitable(el, scope) && elementText(el).length >= 2)
    .slice(0, 30).map(el => ({tag:el.tagName.toLowerCase(),
      role:(el.getAttribute('role') || '').slice(0,30),
      label:titleLines(el).slice(0,2).map(v => v.slice(0,90))}));
  return {ok:true, version:'0.2.3', mode, summary:{elements:scope.querySelectorAll('*').length,
    visibleLines:rootLines.length, suggestions:result.suggested.length, stats:result.stats,
    hasMain:scope !== document.body, iframeCount:scope.querySelectorAll('iframe').length,
    shadowHosts:[...scope.querySelectorAll('*')].filter(el=>Boolean(el.shadowRoot)).length},
    suggestions:result.suggested.slice(0,35), visibleLines:briefLines, cardSamples};
}
browser.runtime.onMessage.addListener(message => {
  if (message?.type === 'INSERT_MENTION') return insertMention(message.name);
  if (message?.type === 'SCAN_PLUGINS') return Promise.resolve(scanDirectory());
  if (message?.type === 'SCAN_DEBUG') return Promise.resolve(scanDebug());
  return undefined;
});
