'use strict';

/* Pure, browser-independent import validation and planning helpers.
   No storage writes or DOM access here, so plans can be tested and reviewed. */
(function (root) {
  const MAX_ITEMS = 500;
  const MAX_CATEGORIES = 60;
  const MAX_BYTES = 1024 * 1024;
  const NAME_LIMIT = 110;
  const CAT_LIMIT = 60;
  const MAX_LINE_LENGTH = 250;

  function normalizeName(value) {
    return typeof value === 'string'
      ? value.trim().replace(/^@+\s*/, '').replace(/\s+/g, ' ').slice(0, NAME_LIMIT)
      : '';
  }
  function normalizeCategory(value) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, CAT_LIMIT) : '';
  }
  function key(value) { return value.toLocaleLowerCase('hu'); }
  function uniqueNames(items) {
    const result = [];
    const keys = new Set();
    let duplicates = 0;
    for (const item of items) {
      const k = key(item.name);
      if (keys.has(k)) { duplicates++; continue; }
      keys.add(k); result.push(item);
    }
    return { items: result, duplicates };
  }
  function checkTooLong(text) {
    if (new TextEncoder().encode(text).byteLength > MAX_BYTES) throw new Error('Túl nagy import: maximum 1 MB-os fájl használható.');
  }
  function parseImport(text) {
    if (typeof text !== 'string') throw new Error('Az import tartalma nem szöveg.');
    const raw = text.replace(/^\uFEFF/, '').trim();
    if (!raw) throw new Error('Üres import. Válassz fájlt, vagy illessz be szöveget.');
    checkTooLong(raw);
    const jsonLike = /^[\[{]/.test(raw);
    if (jsonLike) {
      let data;
      try { data = JSON.parse(raw); }
      catch (err) { throw new Error(`Hibás JSON: ${err.message}`); }
      let inputItems;
      let fullBackup = false;
      let rawCategories = [];
      let lastRefresh = null;
      if (Array.isArray(data)) inputItems = data;
      else if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (Array.isArray(data.items)) { inputItems = data.items; fullBackup = true; }
        else if (Array.isArray(data.plugins)) { inputItems = data.plugins; fullBackup = true; }
        else throw new Error('Ez nem Plugin Deck-mentés: hiányzik az items vagy plugins tömb. A diagnosztikai JSON nem importálható.');
        if (data.categories !== undefined && !Array.isArray(data.categories)) throw new Error('Hibás JSON: a categories mezőnek tömbnek kell lennie.');
        rawCategories = data.categories || [];
        if (typeof data.lastRefresh === 'string') lastRefresh = data.lastRefresh;
      } else throw new Error('A JSON tömb vagy mentési objektum kell legyen.');
      if (inputItems.length > MAX_ITEMS) throw new Error(`A mentés ${inputItems.length} elemes, de legfeljebb ${MAX_ITEMS} plugin importálható.`);
      const cats = [];
      for (const c of rawCategories) {
        if (typeof c !== 'string') continue;
        const cat = normalizeCategory(c);
        if (cat && !cats.includes(cat)) cats.push(cat);
      }
      const items = [];
      let skipped = 0;
      for (const entry of inputItems) {
        if (typeof entry !== 'string' && (!entry || typeof entry !== 'object' || Array.isArray(entry))) { skipped++; continue; }
        const name = normalizeName(typeof entry === 'string' ? entry : entry.name);
        if (!name) { skipped++; continue; }
        let category = typeof entry === 'string' ? 'Egyéb' : normalizeCategory(entry.category) || 'Egyéb';
        if (!cats.includes(category)) cats.push(category);
        items.push({ name, category, favorite: typeof entry === 'object' && Boolean(entry.favorite) });
      }
      if (!items.length && inputItems.length) throw new Error('A JSON nem tartalmaz egyetlen érvényes pluginnevet sem. Semmi nem változott.');
      const dedup = uniqueNames(items);
      return { type: 'json', fullBackup, categories: cats, items: dedup.items, skipped, duplicates: dedup.duplicates, lastRefresh };
    }
    const lines = raw.split(/\r?\n/);
    if (lines.length > MAX_ITEMS) throw new Error(`Túl sok sor (${lines.length}). Maximum ${MAX_ITEMS} név engedélyezett.`);
    const items = [];
    let skipped = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      if (trimmed.length > MAX_LINE_LENGTH) { skipped++; continue; }
      const name = normalizeName(trimmed);
      if (!name) { skipped++; continue; }
      items.push({name, category:'Egyéb', favorite:false});
    }
    if (!items.length) throw new Error('Nem található egyetlen importálható plugin sem.');
    const dedup = uniqueNames(items);
    return { type:'names', fullBackup:false, categories:[], items:dedup.items, skipped, duplicates:dedup.duplicates };
  }
  function planImport(current, parsed, mode, makeId) {
    if (mode !== 'merge' && mode !== 'restore') throw new Error('Ismeretlen importálási mód.');
    if (mode === 'restore' && (parsed.type !== 'json' || !parsed.fullBackup))
      throw new Error('Teljes visszaállításhoz a Deck exportált JSON-mentése szükséges (items vagy plugins tömbbel).');
    const idFn = typeof makeId === 'function' ? makeId : (() => `p-${Math.random().toString(36).slice(2, 12)}`);
    const categories = mode === 'restore' ? [] : [...(current.categories || [])];
    for (const c of parsed.categories) {
      const cat = normalizeCategory(c);
      if (cat && !categories.includes(cat)) categories.push(cat);
    }
    if (!categories.includes('Egyéb')) categories.push('Egyéb');
    if (categories.length > MAX_CATEGORIES) throw new Error(`Túl sok kategória (${categories.length}); maximum ${MAX_CATEGORIES} lehet.`);
    const nextItems = mode === 'restore'
      ? []
      : (current.items || []).map(i => ({ ...i }));
    const keys = new Set(nextItems.map(i => key(i.name)));
    let added = 0, existing = 0;
    for (const entry of parsed.items) {
      const k = key(entry.name);
      if (keys.has(k)) { existing++; continue; }
      if (nextItems.length >= MAX_ITEMS) throw new Error(`A hozzáadás túllépné az ${MAX_ITEMS} elemes határt. Semmit nem módosítottam.`);
      nextItems.push({ id:idFn(), name:entry.name, category:categories.includes(entry.category) ? entry.category:'Egyéb', favorite:entry.favorite, sample:false });
      keys.add(k);
      added++;
    }
    return {
      nextState: { categories, items:nextItems, lastRefresh: mode === 'restore' ? (parsed.lastRefresh || null) : (current.lastRefresh || null) },
      added, existing, oldCount:(current.items || []).length, newCount:nextItems.length,
      imported:parsed.items.length, skipped:parsed.skipped, duplicates:parsed.duplicates,
      categoryCount:categories.length, mode, type:parsed.type
    };
  }
  const api = { parseImport, planImport };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PiDeckImport = api;
})(globalThis);
