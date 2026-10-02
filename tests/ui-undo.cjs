const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert'),vm=require('vm');
(async()=>{
 const data=JSON.parse(fs.readFileSync('data/catalog.json')),dom=new JSDOM(fs.readFileSync('public/index.html','utf8'),{url:'https://citypop.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 w.DATA=data;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:t=>({width:t.length*7})},{get:(o,k)=>o[k]||(()=>{})});w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};
 const eventId='11111111-1111-4111-8111-111111111111',id='candidate_'+'a'.repeat(64),entityId='album_sunshower';
 const c={id,entityId,field:'catalogNumber',value:'NEW',currentValue:'NEW',status:'approved',version:2,sourceUrl:'https://example.org/fixture',sourceType:'fixture',checkedAt:'2026-10-02'};
 const correction={eventId,entityId,field:'catalogNumber',candidateId:id,expectedVersion:2,fromValue:'NEW',toValue:'OLD',canUndo:true,reverted:false};
 const event={id:eventId,candidate_id:id,entityId,field:'catalogNumber',action:'approve',note:'<img src=x>',created_at:'2026-10-02T05:00:00Z',correction};
 let posts=[],mode='conflict',readonly=false,failGraph=false,hideEvents=false;
 w.fetch=async(url,options={})=>{if(options.method==='POST'){posts.push({url,body:JSON.parse(options.body)});if(mode==='conflict')return {ok:false,status:409,json:async()=>({error:'review_conflict'})};c.status='pending';c.version=3;correction.canUndo=false;correction.reverted=true;return {ok:true,status:200,json:async()=>({status:'pending',version:3})}}
 if(url==='/api/graph')return{ok:!failGraph,status:failGraph?503:200,json:async()=>data};return{ok:true,status:200,json:async()=>({canReview:!readonly,candidates:[c],events:hideEvents?[]:[event]})}};
 vm.runInContext(fs.readFileSync('public/app.js','utf8'),dom.getInternalVMContext());w.eval("view='review';render()");await new Promise(setImmediate);await new Promise(setImmediate);
 assert.equal(d.querySelectorAll('#review img').length,0);d.querySelector('[data-undo]').click();assert(d.querySelector('.undo-confirm').textContent.includes('OLD'));assert.equal(posts.length,0);assert.equal(d.activeElement.id,'undo-note');d.querySelector('#undo-cancel').click();assert(!d.querySelector('.undo-confirm'));assert.equal(posts.length,0);
 d.querySelector('[data-undo]').click();await w.submitUndo();assert.equal(posts.length,0);assert(d.querySelector('.review-message').textContent.includes('必填'));
 d.querySelector('#undo-note').value='Restore sourced value';d.querySelector('#undo-note').dispatchEvent(new w.Event('input'));await w.submitUndo();assert.equal(posts.length,1);assert.equal(posts[0].url,'/api/review/undo/'+eventId);assert.equal(posts[0].body.expectedVersion,2);assert.equal(d.querySelector('#undo-note').value,'Restore sourced value');assert(d.querySelector('.review-message').textContent.includes('重新核对'));
 for(const lang of ['en','ja','zh']){d.querySelector(`[data-lang="${lang}"]`).click();assert.equal(d.querySelector('#undo-note').value,'Restore sourced value');assert(d.querySelector('#undo-confirm').textContent)}
 mode='success';await w.submitUndo();assert(!d.querySelector('.undo-confirm'));assert(d.querySelector('.review-history').textContent.includes('已撤销'));assert.equal(c.version,3);
 // Read-only session has no active mutation affordance.
 c.status='approved';c.version=4;correction.canUndo=true;correction.reverted=false;correction.expectedVersion=4;readonly=true;await w.loadReview();assert(d.querySelector('[data-undo]').disabled);
 // A committed write followed by failed reload must be described as saved.
 readonly=false;await w.loadReview();d.querySelector('[data-undo]').click();d.querySelector('#undo-note').value='Second correction';d.querySelector('#undo-note').dispatchEvent(new w.Event('input'));failGraph=true;await w.submitUndo();assert(d.querySelector('.review-message').textContent.includes('已保存'));assert(d.querySelector('.review-message').textContent.includes('刷新失败'));failGraph=false;await w.loadReview();assert(d.querySelector('.review-history').textContent.includes('已撤销'));
 hideEvents=true;c.status='approved';c.correction=correction;correction.canUndo=true;correction.reverted=false;w.eval("reviewFilter='approved'");await w.loadReview();assert(d.querySelector('.review-card [data-undo]'));d.querySelector('.review-card [data-undo]').click();assert(d.querySelector('#undo-confirm'));
 dom.window.close();console.log('PASS undo confirmation, cancel, required reason, immutable target, conflict drafts, translations, readonly and saved-refresh-error UX');
})().catch(e=>{console.error(e);process.exitCode=1});
