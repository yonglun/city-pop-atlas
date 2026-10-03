import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';import assert from 'node:assert/strict';
import {openDatabase} from '../scripts/sqlite-adapter.mjs';
import {readCatalog} from '../server/storage.js';
import {importCandidates,decideCandidate,undoApproval,listReview} from '../server/review.js';
import worker from '../dist/server/index.js';
const seed=JSON.parse(fs.readFileSync('data/catalog.json')),entityId='album_sunshower';
const setup=async()=>{const db=openDatabase();await readCatalog(db,seed);return db};
const sample=(value,field='catalogNumber')=>({entityId,field,value,sourceUrl:'https://example.org/undo-fixture/'+value,checkedAt:'2026-10-02',note:'Network-free undo fixture'});
const approve=async(db,value,field='catalogNumber')=>{const cat=await readCatalog(db,seed),[id]=await importCandidates(db,[sample(value,field)],cat);const row=await db.prepare('SELECT * FROM candidates WHERE id=?').bind(id).first();assert.equal((await decideCandidate(db,id,{decision:'approve',expectedVersion:row.version},cat)).status,200);return db.prepare('SELECT * FROM candidates WHERE id=?').bind(id).first()};
const undo=(db,row,note='Revert fixture')=>undoApproval(db,row.decision_id,{expectedVersion:row.version,note});
const overlay=(db,field='catalogNumber')=>db.prepare('SELECT * FROM attribute_overrides WHERE id=?').bind(entityId+':'+field).first();
const eventCount=db=>db.sqlite.prepare('SELECT count(*) n FROM review_events').get().n;
// Exact restoration, absence vs previous override, reverse stack and immutable retry target.
{
 const db=await setup(),baseline=(await readCatalog(db,seed)).nodes.find(n=>n.id===entityId);
 const a=await approve(db,'A'),aRow=await overlay(db),b=await approve(db,'B');
 assert.equal((await undo(db,a)).status,409);assert.equal((await undo(db,b)).status,200);assert.deepEqual(await overlay(db),aRow);
 let history=await listReview(db,await readCatalog(db,seed));assert(history.events.find(e=>e.id===a.decision_id).correction.canUndo);
 assert.equal((await undo(db,a)).status,200);assert.equal(await overlay(db),null);assert.deepEqual((await readCatalog(db,seed)).nodes.find(n=>n.id===entityId),baseline);
 const a2=await approve(db,'A');const count=eventCount(db);assert((await undo(db,a)).result.repeated);assert.equal(eventCount(db),count);assert.equal((await overlay(db)).candidate_id,a2.id);assert.equal((await db.prepare('SELECT * FROM candidates WHERE id=?').bind(a2.id).first()).status,'approved');
 const outcomes=await Promise.all([undo(db,a2),undo(db,a2)]);assert(outcomes.every(r=>r.status===200));assert.equal(eventCount(db),count+1);assert.equal(await overlay(db),null);
 const c=await approve(db,'2030-01-01','releaseDate');assert.equal((await readCatalog(db,seed)).nodes.find(n=>n.id===entityId).year,2030);assert.equal((await undo(db,c)).status,200);const restored=(await readCatalog(db,seed)).nodes.find(n=>n.id===entityId);assert.equal(restored.year,baseline.year);assert(!restored.sources.includes(sample('2030-01-01').sourceUrl));
 db.sqlite.close();
}
// Legacy overlays have no undo snapshot, but a new correction can restore them exactly.
{
 const db=await setup(),a=await approve(db,'LEGACY'),prior=await overlay(db);db.sqlite.prepare('DELETE FROM approval_snapshots WHERE event_id=?').run(a.decision_id);assert.equal((await undo(db,a)).status,404);const b=await approve(db,'NEW');assert.equal((await undo(db,b)).status,200);assert.deepEqual(await overlay(db),prior);db.sqlite.close();
}
// Catalog refresh persistence: same entity payload is compatible, changed/removed entities block.
{
 const db=await setup(),a=await approve(db,'REFRESH'),original=await overlay(db);const newer=structuredClone(seed);newer.revision='same-payload';await readCatalog(db,newer);assert.equal((await undo(db,a)).status,200);
 const b=await approve(db,'CHANGED');const changed=structuredClone(seed);changed.revision='changed-payload';changed.nodes.find(n=>n.id===entityId).description.en+=' changed';await readCatalog(db,changed);const before=eventCount(db);assert.equal((await undo(db,b)).status,409);assert.equal(eventCount(db),before);assert.equal(JSON.parse((await overlay(db)).payload).value,'CHANGED');
 const removed=structuredClone(changed);removed.revision='removed-entity';removed.nodes=removed.nodes.filter(n=>n.id!==entityId);removed.edges=removed.edges.filter(e=>e.source!==entityId&&e.target!==entityId);await readCatalog(db,removed);assert.equal((await undo(db,b)).status,409);db.sqlite.close();
}
// Failure rolls back every table, and compare-and-swap rejects same-payload tuple replacement.
{
 const db=await setup(),a=await approve(db,'ATOMIC'),prior=await overlay(db),count=eventCount(db);
 const failing={prepare:db.prepare.bind(db),batch:statements=>db.batch([...statements,db.prepare('INSERT INTO missing_undo_table VALUES (1)')])};await assert.rejects(()=>undo(failing,a));assert.deepEqual(await overlay(db),prior);assert.equal(eventCount(db),count);assert.equal(db.sqlite.prepare('SELECT reverted_by FROM approval_snapshots WHERE event_id=?').get(a.decision_id).reverted_by,null);
 const racing={prepare:db.prepare.bind(db),batch:async statements=>{db.sqlite.prepare('UPDATE attribute_overrides SET candidate_id=? WHERE id=?').run('interloper',prior.id);return db.batch(statements)}};assert.equal((await undo(racing,a)).status,409);assert.equal(eventCount(db),count);assert.equal(db.sqlite.prepare('SELECT reverted_by FROM approval_snapshots WHERE event_id=?').get(a.decision_id).reverted_by,null);
 // Approval preimage CAS must also see the altered candidate identity.
 db.sqlite.prepare('UPDATE attribute_overrides SET candidate_id=? WHERE id=?').run(prior.candidate_id,prior.id);const cat=await readCatalog(db,seed),[b]=await importCandidates(db,[sample('CAS')],cat);assert.equal((await decideCandidate(racing,b,{decision:'approve',expectedVersion:1},cat)).status,409);assert.equal(db.sqlite.prepare('SELECT status FROM candidates WHERE id=?').get(b).status,'pending');db.sqlite.close();
}
// Undo vs a later approval must have a single winner with no stale writes.
{
 const db=await setup(),a=await approve(db,'BEFORE'),cat=await readCatalog(db,seed),[b]=await importCandidates(db,[sample('AFTER')],cat);
 const outcomes=await Promise.all([undo(db,a),decideCandidate(db,b,{decision:'approve',expectedVersion:1},cat)]);assert.deepEqual(outcomes.map(x=>x.status).sort(),[200,409]);db.sqlite.close();
}
// An undo completing between initial reads is still reported as an idempotent success.
for(const gate of ['SELECT * FROM candidates','SELECT * FROM attribute_overrides']){
 const db=await setup(),a=await approve(db,'INTERLEAVE');let fired=false;
 const racing={
  batch:db.batch.bind(db),
  prepare(sql){const statement=db.prepare(sql);return {
   bind(...args){const bound=statement.bind(...args);return {
    first:async()=>{if(!fired&&sql.startsWith(gate)){fired=true;assert.equal((await undo(db,a)).status,200)}return bound.first()}
   }}
  }}
 };

 const result=await undo(racing,a);assert.equal(result.status,200);assert(result.result.repeated);assert.equal(db.sqlite.prepare("SELECT count(*) n FROM review_events WHERE action='undo'").get().n,1);db.sqlite.close();
}
// Older still-effective approvals stay reachable beyond the recent 100-event window.
{
 const db=await setup(),a=await approve(db,'OLDER');for(let i=0;i<110;i++)db.sqlite.prepare("INSERT INTO review_events(id,candidate_id,action,note,created_at) VALUES (?,?, 'reject','later fixture',?)").run('later-'+i,a.id,'2099-01-01T00:00:00Z');
 const review=await listReview(db,await readCatalog(db,seed));assert.equal(review.events.length,100);assert(!review.events.some(e=>e.id===a.decision_id));assert(review.candidates.find(c=>c.id===a.id).correction.canUndo);assert.equal((await undo(db,a)).status,200);db.sqlite.close();
}
// New endpoint retains owner-private auth, CSRF, bounded JSON and note/version validation.
{
 const db=await setup(),a=await approve(db,'HTTP'),env={DB:db,SITE_REVIEW_MODE:'owner-private',SITE_REVIEW_ADMIN_USER_IDS:'["fixture-owner"]',SITE_REVIEW_ORIGIN:'https://test.invalid'};
 const headers={'Content-Type':'application/json',Origin:'https://test.invalid','oai-authenticated-user-id':'fixture-owner','Sec-Fetch-Site':'same-origin'};
 const call=(body,h=headers,e=env)=>worker.fetch(new Request('https://test.invalid/api/review/undo/'+a.decision_id,{method:'POST',headers:h,body:JSON.stringify(body)}),e);
 const body={expectedVersion:a.version,note:'Undo HTTP fixture'};
 for(const h of [{...headers,'oai-authenticated-user-id':''},{...headers,Origin:'https://evil.invalid'},{...headers,'Sec-Fetch-Site':'cross-site'}])assert.equal((await call(body,h)).status,403);
 assert.equal((await call(body,headers,{...env,SITE_REVIEW_MODE:'disabled'})).status,403);assert.equal((await call(body,{...headers,'Content-Type':'text/plain'})).status,415);assert.equal((await call({...body,note:''})).status,400);assert.equal((await call({...body,expectedVersion:99})).status,409);assert.equal((await call({...body,padding:'x'.repeat(66000)})).status,400);assert.equal((await call(body)).status,200);
 const graph=await readCatalog(db,seed);assert(!('approvalSnapshots' in graph));db.sqlite.close();
}
// Apply the additive migration to a real on-disk v0.4 schema without losing its review history.
{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'citypop-upgrade-')),file=path.join(dir,'archive.sqlite');const old=new DatabaseSync(file);old.exec('CREATE TABLE _local_migrations(name TEXT PRIMARY KEY)');
 for(const migration of ['0000_groovy_karma.sql','0001_hard_living_tribunal.sql']){old.exec(fs.readFileSync('drizzle/'+migration,'utf8'));old.prepare('INSERT INTO _local_migrations VALUES (?)').run(migration)}
 old.prepare('INSERT INTO review_events(id,candidate_id,action,note,created_at) VALUES (?,?,?,?,?)').run('legacy-event','legacy-candidate','approve','Preserve old audit','2026-10-01');old.close();
 let db=openDatabase(file);assert.equal(db.sqlite.prepare('SELECT note FROM review_events WHERE id=?').get('legacy-event').note,'Preserve old audit');assert.equal(db.sqlite.prepare('SELECT count(*) n FROM approval_snapshots').get().n,0);await readCatalog(db,seed);const a=await approve(db,'DISK');db.sqlite.close();
 db=openDatabase(file);assert.equal((await undo(db,a)).status,200);assert.equal(db.sqlite.prepare("SELECT count(*) n FROM review_events WHERE action='undo'").get().n,1);db.sqlite.close();fs.rmSync(dir,{recursive:true});
}
console.log('PASS approval undo restoration, reverse stack, immutable replay, legacy history, persistence, races, rollback and authorization');
