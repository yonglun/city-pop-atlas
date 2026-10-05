const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert'),vm=require('vm');
const data=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const allArticles=JSON.parse(fs.readFileSync('public/articles.json','utf8'));
const songs=data.nodes.filter(n=>n.type==='song');
const dom=new JSDOM(fs.readFileSync('public/index.html','utf8'),{url:'https://citypop.test',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,d=w.document;w.DATA=data;w.ARTICLES=allArticles;
w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:t=>({width:t.length*7})},{get:(o,k)=>o[k]||(()=>{})});
let frames=[];w.requestAnimationFrame=f=>{frames.push(f);return frames.length};w.cancelAnimationFrame=()=>{};
let currentScroll=0;Object.defineProperty(w,'scrollY',{get:()=>currentScroll});w.scrollTo=p=>{currentScroll=p.top};
vm.runInContext(fs.readFileSync('public/app.js','utf8'),dom.getInternalVMContext());
const flush=()=>{const q=frames;frames=[];q.forEach(f=>f())},click=s=>{assert(d.querySelector(s),s);d.querySelector(s).click()},select=id=>w.eval(`select(${JSON.stringify(id)})`);
assert.equal(songs.length,44);
// Every actual song entry offers its own essay in every language.
for(const language of ['zh','en','ja']){
 click(`[data-lang="${language}"]`);
 for(const song of songs){
  select(song.id);const button=d.querySelector(`#detail [data-article="${song.id}"]`);assert(button,song.id);assert(!/illustrated|挿絵/.test(button.textContent));
  button.click();assert.equal(d.body.dataset.view,'article');assert.equal(d.querySelector('.editorial-article').dataset.essayType,'song');assert.equal(d.activeElement.tagName,'H1');
  const copy=allArticles.find(a=>a.entityId===song.id).locales[language];
  assert.equal(d.querySelector('#article-view h1').textContent,copy.title);assert(d.title.includes(copy.title));assert.equal(d.querySelector('meta[name="description"]').content,copy.dek);assert.equal(d.querySelectorAll('.essay-body p').length,copy.paragraphs.length);
  assert.equal(d.querySelectorAll('#article-view iframe,#detail iframe,#cards iframe').length,0);assert.equal(d.querySelectorAll('.essay-art').length,1);assert(d.querySelector('.essay-art img').src.includes('/illustrations/'+song.id+'.webp'));
  assert(!d.querySelector('#article-view').textContent.includes('undefined'));assert(d.querySelectorAll('.essay-notes a').length>0);
  click('#article-back');flush();assert.equal(d.activeElement.dataset.article,song.id);
 }
}
// Repeated activation cannot replace the return target with the article itself.
select('song_plastic_love');d.querySelector('.detail-shell').scrollTop=317;currentScroll=92;const originalButton=d.querySelector('#detail [data-article]');originalButton.click();originalButton.click();click('[data-lang="ja"]');click('#article-back');flush();assert.equal(d.body.dataset.view,'graph');assert.equal(d.querySelector('.detail-shell').scrollTop,317);assert.equal(currentScroll,92);assert.equal(d.activeElement.dataset.article,'song_plastic_love');
// Catalog filters, expanded result batch and scroll survive song-essay reading.
click('[data-view="catalog"]');w.eval("type='song';catalogGroup='all';catalogLimit=100;render()");assert.equal(d.querySelectorAll('#cards [data-article]').length,44);currentScroll=740;const last=d.querySelectorAll('#cards [data-article]')[43],lastId=last.dataset.article;last.click();w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));flush();assert.equal(d.body.dataset.view,'catalog');assert.equal(w.eval('type'),'song');assert.equal(w.eval('catalogLimit'),100);assert.equal(currentScroll,740);assert.equal(d.activeElement.dataset.article,lastId);
// Changing navigation from an essay remains usable and cannot resurrect stale content.
click(`#cards [data-article="${lastId}"]`);click('[data-view="graph"]');assert.equal(d.querySelector('#article-view').innerHTML,'');select('song_sparkle');click('#detail [data-article]');click('#article-back');flush();assert.equal(d.body.dataset.view,'graph');assert.equal(d.activeElement.dataset.article,'song_sparkle');
dom.window.close();console.log('PASS 44 song essays × 3 locales through actual UI, source links, song-specific art, no hidden players, repeated clicks, Escape, language switching, catalog/detail scroll and focus restoration');
