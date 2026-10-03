import assert from 'node:assert/strict';
import {reviewSession,mutationGuard} from '../server/auth.js';
import worker from '../dist/server/index.js';
const origin='https://admin.test';
const site={SITE_REVIEW_MODE:'owner-private',SITE_REVIEW_ADMIN_USER_IDS:'["fixture-owner"]',SITE_REVIEW_ORIGIN:origin};
const headers={'oai-authenticated-user-id':'fixture-owner','OAI-Sites-Authorization':'Bearer fixture-not-a-credential','x-admin':'true','x-user-role':'admin','x-linux-authenticated-admin':'true'};
const req=(p,method='GET',extra={})=>new Request(origin+p,{method,headers:{...headers,...extra},...(!['GET','HEAD'].includes(method)?{body:'{}'}:{})});
let dbCalls=0;const DB=new Proxy({},{get(){dbCalls++;throw Error('Denied request touched database')}});
const paths=['/api/review','/api/review/preview','/api/review/import','/api/review/candidate_'+'a'.repeat(64),'/api/review/undo/'+'a'.repeat(36),'/api/review/history','/api/review/audit','/api/review/unknown','/api/operations','/api/operations/preview','/api/operations/import','/api/operations/operation_'+'a'.repeat(64),'/api/operations/operation_'+'a'.repeat(64)+'/undo','/api/operations/audit','/api/operations/unknown'];
let count=0;
for(const flag of [false,'true','false',undefined,null,1,{},[]]) {
 const env={...site,LINUX_AUTHENTICATED_ADMIN:flag,DB};
 assert.deepEqual(reviewSession(req('/'),env),{canReview:false,state:'forbidden',provider:'linux'});
 const session=await worker.fetch(req('/api/review-session'),env);assert.equal(session.status,200);assert.equal(session.headers.get('Cache-Control'),'no-store');assert.deepEqual(await session.json(),{canReview:false,state:'forbidden',provider:'linux'});
 for(const p of paths)for(const method of ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS']) {
  const r=await worker.fetch(req(p,method),env);assert.equal(r.status,403);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.deepEqual(await r.json(),{error:'review_not_authorized'});count++;
 }
}
assert.equal(dbCalls,0);
const admin={LINUX_AUTHENTICATED_ADMIN:true,SITE_REVIEW_ORIGIN:origin};
assert.deepEqual(reviewSession(req('/'),admin),{canReview:true,state:'admin',provider:'linux'});
assert.equal(mutationGuard(req('/api/review/preview','POST',{Origin:origin,'Content-Type':'application/json','Sec-Fetch-Site':'same-origin'}),admin),null);
for(const extra of [{},{Origin:'null'},{Origin:'https://evil.test'},{Origin:origin,'Sec-Fetch-Site':'cross-site'}])assert.equal(mutationGuard(req('/api/review/preview','POST',{'Content-Type':'application/json',...extra}),admin).status,403);
assert.equal(mutationGuard(req('/api/review/preview','POST',{Origin:origin,'Content-Type':'text/plain'}),admin).status,415);
assert.equal(mutationGuard(req('/api/review/preview'),admin).status,405);
console.log(`PASS Linux auth: ${count} denied route/method/flag cases, forged Sites config cannot override listener, private session and unchanged CSRF boundary`);
