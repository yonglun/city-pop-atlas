const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict'),vm=require('vm');
const data=JSON.parse(fs.readFileSync('data/catalog.json')),articles=JSON.parse(fs.readFileSync('public/articles.json')),m=JSON.parse(fs.readFileSync('docs/COLLECTION-2026-10-05-ARTISTS-BATCH2.json'));
const dom=new JSDOM(fs.readFileSync('public/index.html','utf8'),{url:'https://citypop.test',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,d=w.document;w.DATA=data;w.ARTICLES=articles;
w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:t=>({width:t.length*7})},{get:(o,k)=>o[k]||(()=>{})});
w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:900,height:700,left:0,top:0});
w.matchMedia=()=>({matches:false});w.scrollTo=()=>{};w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
vm.runInContext(fs.readFileSync('public/app.js','utf8'),dom.getInternalVMContext());assert.equal(w.eval('lang'),'en');
let coreViews=0,contextViews=0,roundTrips=0,sourceNotes=0;
for(const lang of ['en','zh','ja']){
 d.querySelector(`[data-lang="${lang}"]`).click();
 for(const id of m.newCoreIds){
  w.select(id);const n=data.nodes.find(n=>n.id===id),a=articles.find(a=>a.entityId===id);coreViews++;
  assert.equal(d.querySelector('#detail h2').textContent,n.labels[lang]);assert(!d.querySelector('#detail').textContent.includes('[object Object]'));assert(!d.querySelector('#detail').textContent.includes('sourceUrl'),id+' no raw provenance JSON in visible role');
  for(const attr of Object.values(n.attributes)){if(attr.noteLabels){assert(d.querySelector('#detail').textContent.includes(attr.noteLabels[lang]),id+' translated evidence scope');sourceNotes++;}}
  for(const f of d.querySelectorAll('#detail iframe')){assert(!f.getAttribute('allow')?.includes('autoplay'));assert(!f.src.includes('autoplay=1'));}
  const button=d.querySelector('#detail [data-article]');assert(button);button.click();
  assert.equal(d.querySelector('.essay-header h1').textContent,a.locales[lang].title);assert.equal(d.querySelector('.essay-art img').getAttribute('src'),'/illustrations/'+id+'.webp');
  assert.equal(d.querySelectorAll('.essay-body p').length,a.locales[lang].paragraphs.length);assert.equal(d.querySelectorAll('#detail iframe').length,0);assert(!d.querySelector('#article-view').textContent.includes('undefined'));
  d.querySelector('#article-back').click();assert.equal(d.body.dataset.view,'graph');assert.equal(d.querySelector('#detail h2').textContent,n.labels[lang]);
 }
 for(const e of m.editions){
  w.select(e.id);const buttons=[...d.querySelectorAll('.edition-tracks button')];assert.equal(buttons.length,e.tracks.length);
  buttons.forEach((b,i)=>assert(b.textContent.includes(e.tracks[i].title)));
  const ids=[e.id,...data.nodes.filter(n=>n.editionId===e.id).map(n=>n.id)];
  for(const id of ids){
   contextViews++;const n=data.nodes.find(n=>n.id===id),a=articles.find(a=>a.entityId===id);
   w.eval(`selected=${JSON.stringify(id)};view='graph';renderDetail()`);
   assert(d.querySelector('#detail').textContent.includes(n.description[lang]));assert.equal(d.querySelectorAll('#detail iframe').length,0);assert(d.querySelector('#detail [data-article]'));
   for(const attr of Object.values(n.attributes))if(attr.noteLabels)assert(d.querySelector('#detail').textContent.includes(attr.noteLabels[lang]));
   w.eval(`articleId=${JSON.stringify(id)};view='article';renderArticle()`);
   assert.equal(d.querySelector('.essay-header h1').textContent,a.locales[lang].title);assert.equal(d.querySelectorAll('.essay-body p').length,3);assert.equal(d.querySelector('.related-essay button').dataset.article,e.albumId);assert.equal(d.querySelector('.essay-art img').getAttribute('src'),a.illustration.src);assert(d.querySelector('.essay-art figcaption').textContent.includes({zh:'共用',en:'Shared',ja:'共用'}[lang]));
  }
  // All contexts are checked above. Exercise actual history on each edition's boundaries.
  for(const id of [ids[0],ids[1],ids[ids.length-1]]){
   w.setView('graph');w.select(id);d.querySelector('#detail [data-article]').click();assert.equal(d.querySelector('.related-essay button').dataset.article,e.albumId);d.querySelector('.related-essay button').click();assert.equal(w.eval('articleId'),e.albumId);d.querySelector('#article-back').click();assert.equal(w.eval('articleId'),id);d.querySelector('#article-back').click();assert.equal(d.body.dataset.view,'graph');roundTrips++;
  }
 }
}
assert.equal(coreViews,45);assert.equal(contextViews,(m.newNodeIds.length-15)*3);assert.equal(roundTrips,45);
// Every new artist is discoverable through every explicit alias, without changing saved language.
w.setView('catalog');
for(const id of m.newCoreIds.filter(id=>id.startsWith('person_'))){const n=data.nodes.find(n=>n.id===id);for(const alias of n.aliases){w.eval(`query=${JSON.stringify(alias)};type='';catalogGroup='all';catalogLimit=24;render()`);assert(d.querySelector(`[data-entry="${id}"]`),id+' alias '+alias);}}
dom.window.close();console.log(`PASS ${coreViews} core locale views, ${contextViews} complete issue/position locale renders, ${roundTrips} boundary round trips, ${sourceNotes} translated evidence notes, safe media lifecycle and artist alias search`);
