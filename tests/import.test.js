'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {parseImport, planImport} = require('../import-logic.js');
const current = () => ({ categories:['Technika','Zene','Egyéb'], items:[
  {id:'a1',name:'Google Drive',category:'Technika',favorite:true,sample:false},
  {id:'a2',name:'Gmail',category:'Technika',favorite:false,sample:false}
], lastRefresh:'2026-10-26T10:00:00Z' });
const backup = JSON.stringify({version:2,categories:['Kreatív','Zene','Egyéb'],items:[
  {name:'Google Drive',category:'Zene',favorite:false},
  {name:'Pi Suno · Dalszövegíró',category:'Kreatív',favorite:true}
]});
let nextId=0;const idFn=()=>`new-${++nextId}`;
test('exported v0.2.3 JSON is recognized as full backup', () => {
  const parsed=parseImport(backup);
  assert.equal(parsed.fullBackup,true);
  assert.equal(parsed.items[1].favorite,true);
  assert.equal(parsed.items[1].category,'Kreatív');
});
test('merge adds missing names but preserves existing favorites and categories',()=>{
  const plan=planImport(current(),parseImport(backup),'merge',idFn);
  assert.equal(plan.added,1);assert.equal(plan.existing,1);
  assert.deepEqual(plan.nextState.items.find(x=>x.name==='Google Drive').category,'Technika');
  assert.equal(plan.nextState.items.find(x=>x.name==='Google Drive').favorite,true);
  assert.equal(plan.nextState.items.find(x=>x.name==='Pi Suno · Dalszövegíró').favorite,true);
  assert.ok(plan.nextState.categories.includes('Kreatív'));
});
test('restore replaces old items, categories and favorites as in the JSON',()=>{
  const plan=planImport(current(),parseImport(backup),'restore',idFn);
  assert.equal(plan.oldCount,2);assert.equal(plan.newCount,2);
  assert.equal(plan.nextState.items.find(x=>x.name==='Google Drive').favorite,false);
  assert.equal(plan.nextState.items.find(x=>x.name==='Google Drive').category,'Zene');
  assert.equal(plan.nextState.items.find(x=>x.name==='Pi Suno · Dalszövegíró').favorite,true);
  assert.equal(plan.nextState.items.some(x=>x.name==='Gmail'),false);
});
test('pasted plain names remain supported',()=>{
  const parsed=parseImport('@Gmail\n@Adobe Acrobat\n# komment\n\n@Gmail');
  assert.deepEqual(parsed.items.map(x=>x.name),['Gmail','Adobe Acrobat']);
  assert.equal(parsed.duplicates,1);
  const plan=planImport(current(),parsed,'merge',idFn);
  assert.equal(plan.added,1);
  assert.equal(plan.existing,1);
});
test('plain names cannot destructively replace existing settings',()=>{
  assert.throws(()=>planImport(current(),parseImport('@Gmail'),'restore',idFn),/JSON/);
});
test('diagnostic JSON cannot be confused with plugin backup',()=>{
  assert.throws(()=>parseImport('{"ok":true,"summary":{"elements":3375},"suggestions":[]}'),/diagnosztikai JSON/);
});
test('malformed JSON not reinterpreted as plugin names',()=>{
  assert.throws(()=>parseImport('{"items":['),/Hibás JSON/);
});
test('UTF-8 BOM is accepted',()=>{
  assert.equal(parseImport('\uFEFF'+backup).items.length,2);
});
test('old v0.1 plugins shape is accepted',()=>{
  const parsed=parseImport(JSON.stringify({plugins:[{name:'@GPT',category:'Kreatív',favorite:1}]}));
  assert.equal(parsed.fullBackup,true);
  assert.equal(parsed.items[0].name,'GPT');
});
test('duplicate item names are removed case-insensitively',()=>{
  const parsed=parseImport('["@Gmail", "gmail", "@Adobe Acrobat"]');
  assert.equal(parsed.duplicates,1);assert.equal(parsed.items.length,2);
});
test('invalid item list does not erase existing data',()=>{
  assert.throws(()=>parseImport('{"items":[{},{"other":"field"}]}'),/egyetlen érvényes/);
});
test('too many imported items fail safely',()=>{
  assert.throws(()=>parseImport(JSON.stringify({items:Array.from({length:501},(_,i)=>`a${i}`)})),/legfeljebb 500/);
});
test('too-large payload fails safely',()=>{
  assert.throws(()=>parseImport('@'.repeat(1024*1024+1)),/1 MB/);
});
test('unknown category inferred and preserved in restore',()=>{
  const plan=planImport(current(),parseImport('{"items":[{"name":"New","category":"Design","favorite":true}]}'),'restore',idFn);
  assert.ok(plan.nextState.categories.includes('Design'));
  assert.equal(plan.nextState.items[0].category,'Design');
});
test('original current settings not mutated during import planning',()=>{
  const existing=current(); const snapshot=JSON.stringify(existing);
  planImport(existing,parseImport(backup),'restore',idFn);
  assert.equal(JSON.stringify(existing),snapshot);
});

test('JSON export lastRefresh is restored when present',()=>{
  const source = JSON.stringify({...JSON.parse(backup),lastRefresh:'2026-10-28T10:00:00Z'});
  const plan = planImport(current(),parseImport(source),'restore',idFn);
  assert.equal(plan.nextState.lastRefresh,'2026-10-28T10:00:00Z');
});
