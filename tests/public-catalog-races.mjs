import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDatabase} from '../scripts/sqlite-adapter.mjs';
import {readPublicCatalog} from '../server/public-catalog.js';
const seed=JSON.parse(fs.readFileSync('data/catalog.json'));
const gate=()=>{let resolve;return {promise:new Promise(done=>resolve=done),resolve:()=>resolve()}};
const db=openDatabase(),originalBatch=db.batch.bind(db);let imports=0,reads=0;
db.batch=async statements=>{if(statements.some(s=>s.sql==='DELETE FROM entities'))imports++;if(statements.some(s=>s.sql==='SELECT payload FROM entities ORDER BY rowid'))reads++;return originalBatch(statements)};
const first=await Promise.all(Array.from({length:12},()=>readPublicCatalog(db,seed)));
assert(first.every(value=>value===first[0]),'Concurrent cold requests share one effective catalog');
assert.equal(imports,1,'One source import under a burst');assert.equal(reads,1,'One heavy catalog assembly under a burst');
const warm=await Promise.all(Array.from({length:12},()=>readPublicCatalog(db,seed)));assert(warm.every(value=>value===first[0]));assert.equal(reads,1);

const racing=openDatabase(),raceBatch=racing.batch.bind(racing),captured=gate(),release=gate();let pause=true,raceReads=0;
racing.batch=async statements=>{
 const result=await raceBatch(statements);
 if(statements.some(s=>s.sql==='SELECT payload FROM entities ORDER BY rowid')){
  raceReads++;if(pause){pause=false;captured.resolve();await release.promise;}
 }
 return result;
};
const before=readPublicCatalog(racing,seed);await captured.promise;
// A committed editorial transaction lands after the old snapshot read but
// before its asynchronous result is delivered to the caching layer.
const node=JSON.parse(racing.sqlite.prepare('SELECT payload FROM entities WHERE id=?').get(seed.nodes[0].id).payload);
node.labels.en='Post-commit catalog label';
racing.sqlite.exec('BEGIN');
racing.sqlite.prepare('UPDATE entities SET payload=? WHERE id=?').run(JSON.stringify(node),node.id);
racing.sqlite.prepare("UPDATE catalog_state SET epoch=epoch+1 WHERE id='graph'").run();
racing.sqlite.exec('COMMIT');
const after=readPublicCatalog(racing,seed);release.resolve();
const [early,late]=await Promise.all([before,after]);
assert.equal(early,late,'An obsolete in-flight snapshot cannot replace the fresh cache');
assert.equal(late.nodes[0].labels.en,node.labels.en);assert.equal(late.epoch,2);assert.equal(raceReads,2);
assert.equal(await readPublicCatalog(racing,seed),late);

const retry=openDatabase(),retryBatch=retry.batch.bind(retry);let fail=true;
retry.batch=async statements=>{if(fail){fail=false;throw Error('Synthetic transient read failure')}return retryBatch(statements)};
await assert.rejects(()=>readPublicCatalog(retry,seed),/Synthetic transient/);
assert.equal((await readPublicCatalog(retry,seed)).nodes.length,seed.nodes.length,'Failed promises are cleared for safe retry');
const next=structuredClone(seed);next.revision+='-performance-source';next.nodes[0].labels.en='New source label';
const changed=await readPublicCatalog(db,next);assert.equal(changed.revision,next.revision);assert.equal(changed.nodes[0].labels.en,'New source label');assert.notEqual(changed,first[0]);
assert.equal((await readPublicCatalog(retry,seed)).nodes[0].labels.en,seed.nodes[0].labels.en,'Database bindings remain isolated');
for(const item of [db,racing,retry])item.sqlite.close();
console.log('PASS public catalog cache: coalesced cold/warm bursts, transactional epoch race, failure retry, source revision and database isolation');
