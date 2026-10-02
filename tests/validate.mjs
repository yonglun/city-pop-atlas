import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDatabase} from '../scripts/sqlite-adapter.mjs';
import {readCatalog} from '../server/storage.js';
const seed=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const ids=new Set(seed.nodes.map(n=>n.id));assert.equal(ids.size,seed.nodes.length);
const rels=new Set();for(const e of seed.edges){assert(ids.has(e.source)&&ids.has(e.target),e.id);assert(e.sources?.length,e.id+' source');assert(!rels.has(e.id));rels.add(e.id)}
for(const n of seed.nodes){for(const lang of ['zh','en','ja'])assert(n.labels[lang],n.id+' '+lang);assert(n.sources?.length);if(n.artistId)assert(ids.has(n.artistId),n.id+' artist');
 for(const a of Object.values(n.attributes||{}))assert(a.sourceUrl&&a.checkedAt&&a.value!==undefined,n.id+' attribute provenance');
 for(const m of n.media||[])assert(m.sourcePage&&m.license&&m.licenseUrl&&m.creator&&m.status==='verified');
 for(const l of n.serviceLinks||[]){const u=new URL(l.url);assert.equal(u.protocol,'https:');assert(['open.spotify.com','www.youtube.com','youtube.com'].includes(u.hostname));assert(l.sourceUrl&&l.checkedAt&&l.status==='verified')}
}
const db=openDatabase();const first=await readCatalog(db,seed);const second=await readCatalog(db,seed);assert.equal(first.nodes.length,seed.nodes.length);assert.equal(first.edges.length,seed.edges.length);assert.deepEqual(first,second);assert.equal(db.sqlite.prepare('SELECT count(*) as n FROM imports').get().n,1);
for(const n of first.nodes){const input=seed.nodes.find(s=>s.id===n.id);assert.deepEqual(n,input)}
assert(db.sqlite.prepare('EXPLAIN QUERY PLAN SELECT * FROM relationships WHERE source=?').all(seed.nodes[0].id).some(r=>r.detail.includes('idx_relationships_source')));
// New snapshots must remove stale rows and roll back completely on invalid input.
const changed=structuredClone(seed);changed.revision='test-revision-2';const removed=changed.nodes.pop().id;changed.edges=changed.edges.filter(e=>e.source!==removed&&e.target!==removed);changed.nodes[0].media=[];changed.nodes[0].serviceLinks=[];
const replaced=await readCatalog(db,changed);assert(!replaced.nodes.some(n=>n.id===removed));assert.equal(replaced.nodes[0].media.length,0);
const broken=structuredClone(changed);broken.revision='test-broken';broken.edges.push({id:'invalid',source:'missing',target:changed.nodes[0].id,type:'related'});
await assert.rejects(()=>readCatalog(db,broken));assert.equal(db.sqlite.prepare('SELECT id FROM imports ORDER BY rowid DESC LIMIT 1').get().id,'test-revision-2');
await readCatalog(db,seed);
const worker=(await import('../dist/server/index.js')).default;
for(const path of ['/','/app.js','/api/graph','/api/stats','/api/schema','/api/entities/'+seed.nodes[0].id])assert.equal((await worker.fetch(new Request('https://test.invalid'+path),{DB:db})).status,200,path);
assert.equal((await worker.fetch(new Request('https://test.invalid/api/graph'),{})).status,503);
assert.equal((await worker.fetch(new Request('https://test.invalid/api/entities/no-such-id'),{DB:db})).status,404);
assert.equal((await worker.fetch(new Request('https://test.invalid/api/graph',{method:'POST'}),{DB:db})).status,405);
assert.equal((await worker.fetch(new Request('https://test.invalid/.openai/hosting.json'),{DB:db})).status,404);
db.sqlite.close();console.log('PASS catalog provenance + schema + SQLite/D1 adapter + idempotency + Worker endpoints');
