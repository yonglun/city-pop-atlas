const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const data=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const dom=new JSDOM(fs.readFileSync('public/index.html','utf8'),{url:'https://citypop.test',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;w.DATA=data;const context=new Proxy({measureText:t=>({width:t.length*7})},{get:(o,k)=>o[k]||(()=>{})});
w.HTMLCanvasElement.prototype.getContext=()=>context;w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:1000,height:700,left:0,top:0});w.HTMLCanvasElement.prototype.setPointerCapture=()=>{};w.matchMedia=()=>({matches:false});w.scrollTo=()=>{};
let id=0;const frames=new Map();w.requestAnimationFrame=f=>{frames.set(++id,f);return id};w.cancelAnimationFrame=i=>frames.delete(i);const tick=t=>{const q=[...frames.values()];frames.clear();q.forEach(f=>f(t))};
require('vm').runInContext(fs.readFileSync('public/app.js','utf8'),dom.getInternalVMContext());tick(100);const d=w.document;
assert.equal(d.querySelector('#rotation-toggle').getAttribute('aria-pressed'),'true');tick(200);const before=w.eval('yaw');tick(220);assert(w.eval('yaw')>before);
d.querySelector('#graph').dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:20,clientY:20}));assert(w.eval('autoRotate'));d.querySelector('#zoom-in').click();assert(w.eval('autoRotate'));
d.querySelector('[data-view="catalog"]').click();assert(!w.eval('autoRotate'));assert.equal(d.querySelectorAll('.card').length,24);assert(d.querySelectorAll('#cards iframe').length>0);
for(const lang of ['en','ja','zh']){d.querySelector(`[data-lang="${lang}"]`).click();assert.equal(d.documentElement.lang,{en:'en',ja:'ja',zh:'zh-CN'}[lang]);}
w.eval("select('album_sunshower')");assert(d.querySelector('#detail iframe').src.startsWith('https://open.spotify.com/embed/album/'));assert(d.querySelector('#detail .music-link.spotify'));assert(d.querySelectorAll('.facts dd').length>=2);
d.querySelector('#close-detail').click();assert(!d.body.classList.contains('detail-open'));
w.eval("select('person_tatsuro_yamashita')");assert(d.querySelector('#detail img'));assert(d.querySelector('#detail figcaption').textContent.includes('CC BY-SA 2.0'));assert(d.querySelector('#detail .facts').textContent.includes('1953-02-04'));
w.eval("select('song_plastic_love')");assert(d.querySelector('#detail .music-link.youtube'));
d.querySelector('#about-link').click();assert(d.querySelector('#guide').textContent.includes('持久化资料库'));
d.querySelector('[data-view="graph"]').click();d.querySelector('#search').value='__missing__';d.querySelector('#search').dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('#results .result').length,0);
d.querySelector('#clear').click();assert.equal(d.querySelectorAll('#results .result').length,data.nodes.length);assert.equal(d.body.onclick,null);
for(const locale of ['zh','en','ja']){d.querySelector(`[data-lang="${locale}"]`).click();for(const n of data.nodes.filter(n=>n.attributes?.debutYear)){w.eval(`select(${JSON.stringify(n.id)})`);assert(d.querySelector('#detail .facts').textContent.includes(n.attributes.debutYear.noteLabels[locale]),n.id+' visible localized career scope')}}
const noteFixture={attributes:{debutYear:{value:1976,noteLabels:{en:'<img src=x onerror=alert(1)>'}}}};d.querySelector('[data-lang="en"]').click();const safeFacts=w.eval(`facts(${JSON.stringify(noteFixture)})`);assert(safeFacts.includes('&lt;img'));assert(!safeFacts.includes('<img'));
dom.window.close();console.log('PASS DOM rotation, three languages, search, cards, portraits, embeds, links and facts');
