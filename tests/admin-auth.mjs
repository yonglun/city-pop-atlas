import assert from 'node:assert/strict';
import {canReview,reviewSession} from '../server/auth.js';
import worker from '../dist/server/index.js';
const origin='https://admin.test',admin='site-scoped-owner',env={SITE_REVIEW_MODE:'owner-private',SITE_REVIEW_ADMIN_USER_IDS:JSON.stringify([admin]),SITE_REVIEW_ORIGIN:origin};
const req=(path,method='GET',headers={})=>new Request(origin+path,{method,headers,...(!['GET','HEAD'].includes(method)?{body:'{}'}:{})});
let dbCalls=0;const DB=new Proxy({},{get(){dbCalls++;throw Error('Unauthorized database access')}});
const paths=['/api/review','/api/review/preview','/api/review/import','/api/review/candidate_'+'a'.repeat(64),'/api/review/undo/'+'a'.repeat(36),'/api/review/history','/api/review/audit','/api/review/unknown','/api/operations','/api/operations/preview','/api/operations/import','/api/operations/operation_'+'a'.repeat(64),'/api/operations/operation_'+'a'.repeat(64)+'/undo','/api/operations/audit','/api/operations/unknown'];
const contexts=[['anonymous',{},{}],['nonadmin',{'oai-authenticated-user-id':'site-other'},{}],['email-only',{'oai-authenticated-user-email':'owner@example.test'},{}],['client-role',{'x-admin':'true','x-user-id':admin,'x-user-role':'admin'},{}],['service-only',{'OAI-Sites-Authorization':'Bearer fixture-not-a-credential'},{}],['missing-config',{'oai-authenticated-user-id':admin},{SITE_REVIEW_ADMIN_USER_IDS:undefined}],['empty-config',{'oai-authenticated-user-id':admin},{SITE_REVIEW_ADMIN_USER_IDS:'[]'}],['invalid-config',{'oai-authenticated-user-id':admin},{SITE_REVIEW_ADMIN_USER_IDS:'["site-scoped-owner",null]'}],['disabled',{'oai-authenticated-user-id':admin},{SITE_REVIEW_MODE:'disabled'}],['duplicate-identity',{'oai-authenticated-user-id':admin+', site-other'},{}]];
let count=0;
for(const [label,headers,extra] of contexts)for(const path of paths)for(const method of ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS']){const r=await worker.fetch(req(path,method,headers),{...env,...extra,DB});assert.equal(r.status,403,`${label} ${method} ${path}`);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.deepEqual(await r.json(),{error:'review_not_authorized'});count++}
assert.equal(dbCalls,0);
assert(canReview(req('/', 'GET',{'oai-authenticated-user-id':admin}),env));
assert(!canReview(req('/','GET',{'oai-authenticated-user-id':' site-other '}),env));
assert.deepEqual(reviewSession(req('/'),env),{canReview:false,state:'signed-out'});
assert.deepEqual(reviewSession(req('/','GET',{'oai-authenticated-user-id':admin}),env),{canReview:true,state:'admin'});
assert.deepEqual(reviewSession(req('/','GET',{'oai-authenticated-user-id':'other'}),env),{canReview:false,state:'forbidden'});
assert.deepEqual(reviewSession(req('/','GET',{'oai-authenticated-user-id':admin}),{...env,SITE_REVIEW_ADMIN_USER_IDS:'[]'}),{canReview:false,state:'setup-required',accountId:admin});
for(const headers of [{},{'oai-authenticated-user-id':'other'},{'oai-authenticated-user-id':admin}]){const r=await worker.fetch(req('/api/review-session','GET',headers),env);assert.equal(r.status,200);const session=await r.json();assert(!('accountId'in session));assert(!JSON.stringify(session).includes(admin));}
assert.equal((await worker.fetch(req('/api/review-session','HEAD'),env)).status,405);
console.log(`PASS administrator authorization: ${count} denied route/method/identity/configuration cases, no DB access, exact allowlist and self-identity minimization`);
