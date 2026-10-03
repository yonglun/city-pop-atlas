const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert'),vm=require('vm');
(async()=>{
 const data=JSON.parse(fs.readFileSync('data/catalog.json')),dom=new JSDOM(fs.readFileSync('public/index.html','utf8'),{url:'https://citypop.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.DATA=data;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:t=>({width:t.length*7})},{get:(o,k)=>o[k]||(()=>{})});w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:1000,height:700,left:0,top:0});w.matchMedia=()=>({matches:false});w.scrollTo=()=>{};w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};

 const candidates=['a','b'].map(letter=>({id:'candidate_'+letter.repeat(64),entityId:'album_mignonne',field:'releaseDate',value:'1978-09-25',currentValue:'1978-09-21',status:'pending',version:1,sourceUrl:'https://example.org/fixture',sourceType:'fixture',checkedAt:'2026-10-02',note:'Fixture'}));
 w.fetch=async(url)=>({ok:true,json:async()=>url==='/api/review-session'?{canReview:true,state:'admin'}:url==='/api/review'?{canReview:true,candidates,events:[]}:url==='/api/operations'?{canReview:true,operations:[],events:[]}:data});
 vm.runInContext(fs.readFileSync('public/app.js','utf8'),dom.getInternalVMContext());
 w.eval("view='review';render()");await new Promise(setImmediate);await new Promise(setImmediate);
 const d=w.document;
 function check(context){
  const ids=[...d.querySelectorAll('[id]')].map(el=>el.id);assert.equal(new Set(ids).size,ids.length,context+': duplicate ids');
  const fields=[...d.querySelectorAll('#review input,#review select,#review textarea')];assert(fields.length>5,context+': populated forms');
  for(const field of fields){assert(field.id.trim()||field.name.trim(),context+': missing id/name '+field.outerHTML);assert(field.getAttribute('aria-label')?.trim()||[...field.labels||[]].some(label=>label.textContent.trim()),context+': missing accessible label '+field.outerHTML)}
  for(const field of d.querySelectorAll('[data-op-input]')){assert.equal(field.id,'operation-input-'+field.dataset.opInput);assert.equal(field.name,field.dataset.opInput)}
 }
 for(const language of ['zh','en','ja']){
  d.querySelector('[data-lang="'+language+'"]').click();
  for(const kind of ['entity','relationship','recording_match','merge']){
   const select=d.querySelector('#operation-draft-kind');select.value=kind;select.dispatchEvent(new w.Event('change'));
   check(language+' '+kind);
  }
 }
 assert.equal(d.querySelectorAll('[data-review-note]').length,2);
 const note=d.querySelector('[data-review-note]'),id=note.id;note.value='Preserved identified note';note.dispatchEvent(new w.Event('input'));w.eval('renderReview()');assert.equal(d.getElementById(id).value,'Preserved identified note');check('rerender');
 dom.window.close();console.log('PASS review form identifiers: four draft types, three languages, multiple notes, unique ids, accessible labels and preserved notes');
})().catch(e=>{console.error(e);process.exitCode=1});
