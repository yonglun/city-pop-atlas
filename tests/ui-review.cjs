const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert'),vm=require('vm');
(async()=>{
 const data=JSON.parse(fs.readFileSync('data/catalog.json')),dom=new JSDOM(fs.readFileSync('public/index.html','utf8'),{url:'https://citypop.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.DATA=data;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:t=>({width:t.length*7})},{get:(o,k)=>o[k]||(()=>{})});w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:1000,height:700,left:0,top:0});w.matchMedia=()=>({matches:false});w.scrollTo=()=>{};w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
 let blocked=true;const c={id:'candidate_'+'a'.repeat(64),entityId:'album_mignonne',field:'releaseDate',value:'1978-09-25',currentValue:'1978-09-21',status:'pending',version:1,sourceUrl:'https://example.org/fixture',sourceType:'fixture',checkedAt:'2026-10-02',note:'<img src=x onerror=alert(1)>'};
 w.fetch=async(url,options={})=>{if(options.method==='POST')return{ok:false,status:409,json:async()=>({error:'source_value_changed'})};return{ok:true,status:200,json:async()=>url==='/api/review'?{canReview:!blocked,candidates:[c],events:[]}:data}};
 vm.runInContext(fs.readFileSync('public/app.js','utf8'),dom.getInternalVMContext());w.eval("view='review';render()");await new Promise(setImmediate);await new Promise(setImmediate);
 const d=w.document;assert.equal(d.querySelectorAll('.review-card').length,1);assert.equal(d.querySelectorAll('#review img').length,0);assert(d.querySelector('[data-decision]').disabled);
 blocked=false;await w.loadReview();const note=d.querySelector('[data-review-note]');note.value='Keep this note after conflict';note.dispatchEvent(new w.Event('input'));
 await w.submitReview(c.id,'approve');assert.equal(d.querySelector('[data-review-note]').value,'Keep this note after conflict');assert(d.querySelector('.review-message').textContent.includes('重新核对'));
 w.eval("select('edition_timely_2008_flcf4243')");assert.equal(d.querySelectorAll('.edition-tracks li').length,11);
 w.eval("select('album_timely_2008')");assert.equal(w.eval('selected'),'edition_timely_2008_flcf4243');
 w.eval("select('edition_timely_2023_fljf9535')");assert.equal(d.querySelectorAll('.edition-tracks li').length,10);
 w.eval("select('work_four_am')");assert(d.querySelector('.source-conflict').textContent.includes('429'));
 dom.window.close();console.log('PASS review UI readonly, escaping, preserved notes, edition ordering and legacy alias');
})().catch(e=>{console.error(e);process.exitCode=1});
