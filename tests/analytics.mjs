import assert from 'node:assert/strict';
import {analyticsConfig} from '../server/analytics.js';
import worker from '../dist/server/index.js';
const req=(method='GET',headers={})=>new Request('https://fixture.test/api/public-config',{method,headers});
const configured={GA_MEASUREMENT_ID:' G-TEST1234 ',CLARITY_PROJECT_ID:' test1234 ',SITE_REVIEW_ADMIN_USER_IDS:'["private-owner-id"]',SITE_REVIEW_MODE:'owner-private',SECRET:'never-public'};
assert.deepEqual(analyticsConfig(req(),{}),{gaMeasurementId:'',clarityProjectId:'',blocked:false});
for(const value of ['<script>','https://evil.test','G-','G-a123','G-ABC&x=1','G-'+'A'.repeat(30)])assert.equal(analyticsConfig(req(),{GA_MEASUREMENT_ID:value}).gaMeasurementId,'');
for(const value of ['<script>','https://evil.test','a b','../abcd','ABCD','x'.repeat(33)])assert.equal(analyticsConfig(req(),{CLARITY_PROJECT_ID:value}).clarityProjectId,'');
for(const headers of [{DNT:'1'},{'Sec-GPC':'1'},{'oai-authenticated-user-id':'private-owner-id'}]){const response=await worker.fetch(req('GET',headers),configured);assert.deepEqual(await response.json(),{gaMeasurementId:'',clarityProjectId:'',blocked:true})}
let dbCalls=0;const DB=new Proxy({},{get(){dbCalls++;throw Error('No database dependency')}});
const response=await worker.fetch(req(),{...configured,DB});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{gaMeasurementId:'G-TEST1234',clarityProjectId:'test1234',blocked:false});assert.equal(dbCalls,0);
for(const method of ['POST','HEAD','OPTIONS','PUT'])assert.equal((await worker.fetch(req(method),configured)).status,405);
console.log('PASS analytics public config: strict allowlist, malformed IDs, admin/DNT/GPC suppression, methods and no DB/secrets');
