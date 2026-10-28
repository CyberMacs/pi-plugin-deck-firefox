'use strict';

const STORAGE_KEY = 'pi-plugin-deck-v02';
const DEFAULT_CATEGORIES = ['Kreatív', 'Kutatás', 'Munka', 'Fejlesztés', 'Egyéb'];
const EXAMPLES = [
  { name: 'Gmail', category: 'Munka', sample: true },
  { name: 'Google Drive', category: 'Munka', sample: true },
  { name: 'Adobe Acrobat', category: 'Munka', sample: true }
];

const $ = id => document.getElementById(id);
let state = { categories: [...DEFAULT_CATEGORIES], items: [], lastRefresh: null };
let activeCategory = 'Mind';
let editingId = null;

function cleanName(raw) {
  return String(raw || '').trim().replace(/^@+\s*/, '').replace(/\s+/g, ' ').slice(0, 110);
}
function makeId() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
function readItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanName(raw.name);
  if (!name) return null;
  const category = typeof raw.category === 'string' && state.categories.includes(raw.category) ? raw.category : 'Egyéb';
  return { id: typeof raw.id === 'string' && raw.id.length < 80 ? raw.id : makeId(),
    name, category, favorite: Boolean(raw.favorite), sample: Boolean(raw.sample) };
}
async function save() {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}
function status(message, tone = '') {
  $('status').textContent = message;
  $('status').className = tone;
}
function build(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}
function sortedCategories() {
  return state.categories.filter(cat => state.items.some(x => x.category === cat));
}
function filterItems() {
  const search = $('search').value.toLocaleLowerCase('hu').trim();
  return state.items.filter(item =>
    (activeCategory === 'Mind' || (activeCategory === 'Kedvencek' ? item.favorite : item.category === activeCategory)) &&
    item.name.toLocaleLowerCase('hu').includes(search));
}
function render() {
  const filters = $('filters');
  const categories = ['Mind', 'Kedvencek', ...state.categories];
  filters.replaceChildren();
  for (const cat of categories) {
    const chip = build('button', 'pill' + (activeCategory === cat ? ' active' : ''), cat === 'Mind' ? 'Összes' : cat === 'Kedvencek' ? '★ Kedvencek' : cat);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(activeCategory === cat));
    chip.addEventListener('click', () => { activeCategory = cat; render(); });
    filters.append(chip);
  }
  const items = filterItems();
  const list = $('list');
  list.replaceChildren();
  const groupCategories = activeCategory === 'Mind' || activeCategory === 'Kedvencek' ? state.categories : [activeCategory];
  for (const cat of groupCategories) {
    const groupItems = items.filter(item => item.category === cat).sort((a, b) =>
      Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, 'hu'));
    if (!groupItems.length) continue;
    const group = build('section', 'group');
    const heading = build('div', 'group-label');
    heading.append(build('span', null, cat), build('b', null, String(groupItems.length)));
    group.append(heading);
    for (const item of groupItems) {
      const row = build('div', 'item');
      const insert = build('button', 'item-main');
      insert.type = 'button';
      insert.title = `@${item.name} beillesztése a ChatGPT-be`;
      insert.append(build('span', 'at-sign', '@'), build('span', 'item-title', item.name));
      insert.addEventListener('click', () => void insertMention(item));
      const fav = build('button', 'item-btn' + (item.favorite ? ' favorite' : ''), item.favorite ? '★' : '☆');
      fav.title = item.favorite ? 'Eltávolítás a kedvencekből' : 'Kedvencnek jelölés';
      fav.setAttribute('aria-label', fav.title);
      fav.addEventListener('click', async () => { item.favorite = !item.favorite; await save(); render(); });
      const edit = build('button', 'item-btn edit-btn', '✎');
      edit.title = `${item.name} szerkesztése`;
      edit.setAttribute('aria-label', edit.title);
      edit.addEventListener('click', () => openEditor(item));
      row.append(insert, fav, edit);
      group.append(row);
    }
    list.append(group);
  }
  const empty = $('empty');
  empty.hidden = items.length !== 0;
  if (!items.length) {
    empty.replaceChildren(build('strong', null, state.items.length ? 'Nincs találat' : 'A pluginlista még üres'),
      build('span', null, state.items.length ? 'Próbálj másik keresést vagy kategóriát.' : 'Nyomd meg a ↻ Frissítés gombot, vagy vedd fel kézzel a pluginokat.'));
  }
}
async function load() {
  const allStored = await browser.storage.local.get([STORAGE_KEY, 'pi_plugin_deck_v1']);
  const stored = allStored[STORAGE_KEY];
  if (stored && typeof stored === 'object') {
    const cats = Array.isArray(stored.categories) ? stored.categories.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, 60)) : [];
    state.categories = [...new Set([...cats, 'Egyéb'])].slice(0, 60);
    state.items = (Array.isArray(stored.items) ? stored.items : []).slice(0, 500).map(readItem).filter(Boolean);
    state.lastRefresh = typeof stored.lastRefresh === 'string' ? stored.lastRefresh : null;
  } else if (Array.isArray(allStored.pi_plugin_deck_v1?.plugins)) {
    const previous = allStored.pi_plugin_deck_v1.plugins.slice(0, 500);
    for (const cat of previous.map(x => String(x.category || '').trim().slice(0, 60))) {
      if (cat && !state.categories.includes(cat) && state.categories.length < 60) state.categories.splice(state.categories.length - 1, 0, cat);
    }
    state.items = previous.map(old => readItem({ ...old, sample: Boolean(old.example) })).filter(Boolean);
    await save();
    status(`A v0.1 listájából ${state.items.length} elem átvéve, kategóriákkal és kedvencekkel.`, 'success');
  } else {
    state.items = EXAMPLES.map(x => ({ ...x, id: makeId(), favorite: false }));
    await save();
    status('3 mintaelem látható, nem a fiókod lekért listája.', 'warning');
  }
  render();
}

async function findChatTab() {
  const current = await browser.tabs.query({ active: true, currentWindow: true });
  if (current[0]?.url?.startsWith('https://chatgpt.com/') && !directoryMode(current[0].url)) return current[0];
  const all = await browser.tabs.query({ currentWindow: true, url: 'https://chatgpt.com/*' });
  const found = all.find(t => !directoryMode(t.url) && !new URL(t.url).pathname.startsWith('/plugins'));
  if (found) return found;
  return browser.tabs.create({ url: 'https://chatgpt.com/', active: true });
}
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function sendToChat(tabId, message) {
  let lastError;
  for (let i = 0; i < 26; i++) {
    try { return await browser.tabs.sendMessage(tabId, message); }
    catch (err) { lastError = err; await delay(350); }
  }
  throw lastError || new Error('A ChatGPT oldal nem érhető el.');
}
async function insertMention(item) {
  status(`Beillesztés: @${item.name} …`);
  try {
    const tab = await findChatTab();
    await browser.tabs.update(tab.id, { active: true });
    const reply = await sendToChat(tab.id, { type: 'INSERT_MENTION', name: item.name });
    if (!reply?.ok) throw new Error(reply?.error || 'Nem sikerült beilleszteni.');
    if (reply.picked) status(`@${item.name}: a ChatGPT találatára kattintottam. Küldés előtt ellenőrizd.`, 'success');
    else status(`@${item.name} beillesztve. Ha megjelenik a ChatGPT menüje, válaszd ki a plugint.`, 'warning');
  } catch (error) {
    try {
      await navigator.clipboard.writeText(`@${item.name}`);
      status(`Beillesztés nem sikerült; @${item.name} a vágólapra került. Ctrl+V-vel illesztheted be.`, 'warning');
    } catch (_) { status(`Hiba: ${String(error.message || error)}. Használd az Import/Export másolást.`, 'warning'); }
  }
}
function openEditor(item = null) {
  editingId = item?.id || null;
  $('editorTitle').textContent = item ? 'Plugin szerkesztése' : 'Új plugin';
  $('deletePlugin').hidden = !item;
  $('pluginName').value = item?.name || '';
  $('pluginFavorite').checked = Boolean(item?.favorite);
  const select = $('pluginCategory');
  select.replaceChildren();
  for (const cat of state.categories) {
    const option = build('option', '', cat);
    option.value = cat;
    select.append(option);
  }
  select.value = item?.category || (activeCategory !== 'Mind' && activeCategory !== 'Kedvencek' ? activeCategory : 'Egyéb');
  $('editor').showModal();
  $('pluginName').focus();
}
$('editorForm').addEventListener('submit', async event => {
  event.preventDefault();
  const name = cleanName($('pluginName').value);
  if (!name) return;
  const duplicate = state.items.find(x => x.name.toLocaleLowerCase('hu') === name.toLocaleLowerCase('hu') && x.id !== editingId);
  if (duplicate) { status('Már szerepel ilyen nevű plugin.', 'warning'); return; }
  const item = state.items.find(x => x.id === editingId);
  if (item) Object.assign(item, { name, category: $('pluginCategory').value, favorite: $('pluginFavorite').checked, sample: false });
  else state.items.push({ id: makeId(), name, category: $('pluginCategory').value, favorite: $('pluginFavorite').checked, sample: false });
  await save();
  $('editor').close();
  activeCategory = 'Mind';
  render();
  status(`Mentve: @${name}`, 'success');
});
$('cancelEdit').addEventListener('click', () => $('editor').close());
$('deletePlugin').addEventListener('click', async () => {
  const item = state.items.find(x => x.id === editingId);
  if (!item || !confirm(`Törlöd a „${item.name}” elemet a helyi Deck-listából? A ChatGPT plugin telepítése változatlan marad.`)) return;
  state.items = state.items.filter(x => x.id !== editingId);
  await save(); $('editor').close(); render();
  status(`Eltávolítva a helyi listából: ${item.name}`, 'success');
});
$('addPlugin').addEventListener('click', () => openEditor());
$('search').addEventListener('input', render);
$('openChat').addEventListener('click', () => browser.tabs.create({ url: 'https://chatgpt.com/', active: true }));

function renderCategoryEditor() {
  const host = $('categoryRows');
  host.replaceChildren();
  for (const cat of state.categories) {
    const row = build('div', 'category-row');
    const input = build('input');
    input.value = cat;
    input.disabled = cat === 'Egyéb';
    input.title = cat === 'Egyéb' ? 'Az Egyéb kategória nem nevezhető át.' : 'Kategória átnevezése (Enter vagy kattintás máshová)';
    const applyRename = async () => {
      const next = input.value.trim().slice(0, 60);
      if (!next || next === cat) { input.value = cat; return; }
      if (state.categories.includes(next)) { input.value = cat; status('Ilyen kategória már létezik.', 'warning'); return; }
      state.categories = state.categories.map(x => x === cat ? next : x);
      state.items.forEach(item => { if (item.category === cat) item.category = next; });
      if (activeCategory === cat) activeCategory = next;
      await save(); renderCategoryEditor(); render();
    };
    input.addEventListener('blur', () => void applyRename());
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); input.blur(); } });
    row.append(input);
    if (cat !== 'Egyéb') {
      const remove = build('button', 'ghost', '×');
      remove.type = 'button'; remove.title = 'Kategória törlése';
      remove.addEventListener('click', async () => {
        if (!confirm(`Törlöd a „${cat}” kategóriát? A benne lévő pluginok átkerülnek az „Egyéb” kategóriába.`)) return;
        state.categories = state.categories.filter(x => x !== cat);
        state.items.forEach(item => { if (item.category === cat) item.category = 'Egyéb'; });
        if (activeCategory === cat) activeCategory = 'Mind';
        await save(); renderCategoryEditor(); render();
      });
      row.append(remove);
    }
    host.append(row);
  }
}
$('manageCategories').addEventListener('click', () => { renderCategoryEditor(); $('catDialog').showModal(); });
$('closeCats').addEventListener('click', () => $('catDialog').close());
$('categoryForm').addEventListener('submit', async event => {
  event.preventDefault();
  const value = $('newCategory').value.trim().slice(0, 60);
  if (!value || state.categories.includes(value)) { status('Üres vagy már létező kategória.', 'warning'); return; }
  if (state.categories.length >= 60) return;
  state.categories.splice(state.categories.length - 1, 0, value);
  $('newCategory').value = '';
  await save(); renderCategoryEditor(); render();
});

function directoryMode(urlString) {
  try {
    const url = new URL(urlString);
    if (url.origin !== 'https://chatgpt.com' || url.pathname !== '/plugins') return null;
    const personal = url.searchParams.get('directoryTab') === 'personal';
    const created = personal && url.searchParams.get('category') === 'plugins-created-by-you';
    return created ? 'created' : personal ? 'personal' : 'other';
  } catch (_) { return null; }
}
async function scanTab(tab) {
  // React can still be rendering when the button is pressed; a short retry
  // avoids a false empty result. No network API or automatic page scraping.
  let found = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const result = await browser.tabs.sendMessage(tab.id, { type: 'SCAN_PLUGINS' });
      if (result?.names?.length) return result;
      if (result) found = result;
    } catch (_) { /* Old tab may still have v0.2 content scripts; reload it. */ }
    if (attempt < 4) await delay(300);
  }
  return found;
}
let scanPending = [];
function sourceLabel(result) {
  return result.mode === 'created' ? 'Created by you' : result.mode === 'personal' ? 'Personal' : 'Installed';
}
async function addNames(rows) {
  let added = 0;
  for (const raw of rows) {
    const name = cleanName(raw.name || raw);
    if (!name || name.length < 2 || state.items.some(item => item.name.toLocaleLowerCase('hu') === name.toLocaleLowerCase('hu'))) continue;
    if (state.items.length >= 500) break;
    state.items.push({id:makeId(),name,category:'Egyéb',favorite:false,sample:false});
    added++;
  }
  state.lastRefresh = new Date().toISOString();
  await save(); render();
  return added;
}
function reviewSuggestions(rows, label) {
  scanPending = rows;
  const root = $('scanCandidates'); root.replaceChildren();
  $('scanHint').textContent = `${label}: ${rows.length} javaslat. Ellenőrizd a pontos neveket; ezek a ChatGPT felületéből becsült értékek.`;
  for (let idx=0;idx<rows.length;idx++) {
    const item=rows[idx];
    const line=build('label','scan-row');
    const check=build('input'); check.type='checkbox';check.checked=item.confidence >= 2;check.dataset.index=String(idx);
    const label=build('span');label.append(build('span','',item.name),build('small','',`Forrás: ${item.evidence} · ${item.confidence >= 3 ? 'erős' : 'bizonytalan'} felismerés`));
    line.append(check,label);root.append(line);
  }
  $('scanDialog').showModal();
}
$('scanCancel').addEventListener('click', () => $('scanDialog').close());
$('scanSelectAll').addEventListener('click', () => { for (const checkbox of $('scanCandidates').querySelectorAll('input[type="checkbox"]')) checkbox.checked = true; });
$('scanSelectNone').addEventListener('click', () => { for (const checkbox of $('scanCandidates').querySelectorAll('input[type="checkbox"]')) checkbox.checked = false; });
$('scanConfirm').addEventListener('click', async () => {
  const rows = [...$('scanCandidates').querySelectorAll('input[type="checkbox"]')]
    .filter(el=>el.checked).map(el=>scanPending[Number(el.dataset.index)]).filter(Boolean);
  const count = await addNames(rows);
  $('scanDialog').close();
  status(`${count} új név hozzáadva, a meglévő kategóriák megmaradtak.`, 'success');
});
async function locateDirectoryTab() {
  const tabs = await browser.tabs.query({url:'https://chatgpt.com/*',currentWindow:true});
  const active = (await browser.tabs.query({active:true,currentWindow:true}))[0];
  const sorted = tabs.filter(t=>directoryMode(t.url)).sort((a,b)=>{
    const rank = t=>directoryMode(t.url)==='created'?100:directoryMode(t.url)==='personal'?50:10;
    return rank(b)-rank(a) || Number(b.id===active?.id)-Number(a.id===active?.id);
  });
  return sorted[0] || null;
}
async function refreshInstalled() {
  $('refresh').disabled = true;
  status('Created by you lista ellenőrzése…');
  try {
    const selected = await locateDirectoryTab();
    if (!selected) {
      await browser.tabs.create({url:'https://chatgpt.com/plugins?directoryTab=personal&category=plugins-created-by-you',active:true});
      status('Megnyitottam a Created by you oldalt. Betöltés után kattints újra a Frissítésre.', 'warning');
      return;
    }
    const best = await scanTab(selected);
    if (!best?.suggested?.length) {
      const amount = best?.inspected !== undefined ? ` Vizsgált elemek: ${best.inspected}.` : '';
      status(`Nincs biztos plugin-találat a ${sourceLabel(best || {mode:directoryMode(selected.url)})} nézetben.${amount} Használd a ⌕ Diagnosztika gombot; a helyi lista nem változott.`, 'warning');
      return;
    }
    const candidates = best.suggested.filter(item => !state.items.some(old => old.name.toLocaleLowerCase('hu') === item.name.toLocaleLowerCase('hu')));
    if (!candidates.length) {
      status(`${sourceLabel(best)}: ${best.suggested.length} felismert név, mind szerepel már a Deckben.`, 'success');
      return;
    }
    if (best.needsReview) {
      reviewSuggestions(candidates, sourceLabel(best));
      status(`${best.suggested.length} névjavaslat, ebből ${candidates.length} új. Ellenőrizd az előnézetet.`, 'warning');
    } else {
      const added = await addNames(candidates);
      status(`${sourceLabel(best)}: ${best.suggested.length} felismert név, ${added} új elem.`, 'success');
    }
  } catch (error) { status(`Frissítési hiba: ${String(error.message || error)}`, 'warning'); }
  finally { $('refresh').disabled = false; }
}
async function showDiagnostics() {
  status('A pluginlista diagnosztikai mintájának olvasása…');
  try {
    let tab=await locateDirectoryTab();
    if (!tab) {
      await browser.tabs.create({url:'https://chatgpt.com/plugins?directoryTab=personal&category=plugins-created-by-you',active:true});
      status('Megnyitottam a Created by you oldalt. Betöltés után kattints újra a Diagnosztikára.', 'warning');
      return;
    }
    const result = await sendToChat(tab.id,{type:'SCAN_DEBUG'});
    if (!result?.ok) throw new Error(result?.message || 'Diagnosztika nem elérhető. Frissítsd a ChatGPT-oldalt.');
    $('debugOutput').value=JSON.stringify(result,null,2);
    $('debugDialog').showModal();
    status(`Diagnosztika: ${result.summary?.visibleLines ?? 0} látható szövegsor, ${result.summary?.suggestions ?? 0} javaslat.`, 'warning');
  } catch(error) {status(`Diagnosztikai hiba: ${String(error.message || error)}. Ctrl+R a ChatGPT-lapon.`, 'warning');}
}
$('diagnostics').addEventListener('click',()=>void showDiagnostics());
$('debugClose').addEventListener('click',()=>$('debugDialog').close());
$('debugCopy').addEventListener('click',async()=>{
  try {await navigator.clipboard.writeText($('debugOutput').value);status('Diagnosztika vágólapra másolva. Megosztás előtt ellenőrizd a szöveget.','success');}
  catch(err){ $('debugOutput').focus();$('debugOutput').select();status('Válaszd a Ctrl+C-t a kijelölt diagnosztikai szöveg másolásához.','warning');}
});
$('refresh').addEventListener('click', () => void refreshInstalled());

$('showImport').addEventListener('click', () => $('dataDialog').showModal());
$('closeData').addEventListener('click', () => $('dataDialog').close());
$('exportData').addEventListener('click', async () => {
  const payload = JSON.stringify({ version: 2, categories: state.categories, items: state.items, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'pi-plugin-deck.json'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  status('A lista JSON exportja elindult.', 'success');
});
$('importData').addEventListener('click', async () => {
  const raw = $('importText').value.trim();
  if (!raw || raw.length > 250000) { status('Üres vagy túl nagy import.', 'warning'); return; }
  let names = [];
  let importedState = null;
  try {
    const json = JSON.parse(raw);
    if (json && typeof json === 'object' && Array.isArray(json.items)) {
      importedState = json;
      names = json.items;
    } else if (Array.isArray(json)) names = json;
    else throw new Error('Ismeretlen JSON formátum');
  } catch (err) {
    if (/^[\[{]/.test(raw)) { status(`JSON hiba: ${err.message}`, 'warning'); return; }
    names = raw.split(/[\r\n]+/g);
  }
  if (importedState && Array.isArray(importedState.categories)) {
    for (const cat of importedState.categories.filter(x => typeof x === 'string').map(x => x.trim().slice(0, 60))) {
      if (cat && !state.categories.includes(cat) && state.categories.length < 60) state.categories.splice(state.categories.length - 1, 0, cat);
    }
  }
  let added = 0;
  for (const rawItem of names.slice(0, 500)) {
    const name = cleanName(typeof rawItem === 'string' ? rawItem : rawItem?.name);
    if (!name || state.items.some(x => x.name.toLocaleLowerCase('hu') === name.toLocaleLowerCase('hu')) || state.items.length >= 500) continue;
    const rawCat = typeof rawItem === 'object' && rawItem !== null ? rawItem.category : undefined;
    state.items.push({ id: makeId(), name, category: state.categories.includes(rawCat) ? rawCat : 'Egyéb', favorite: Boolean(rawItem?.favorite), sample: false });
    added++;
  }
  await save(); render();
  $('dataDialog').close();
  status(`${added} új plugin hozzáadva. A kategóriák megmaradtak.`, 'success');
});
$('showHelp').addEventListener('click', () => $('helpDialog').showModal());
$('closeHelp').addEventListener('click', () => $('helpDialog').close());

void load().catch(err => status(`Adatbetöltési hiba: ${String(err)}`, 'warning'));
