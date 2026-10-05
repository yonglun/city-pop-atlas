// Locale selection must be independent of the browser, safe when storage is unavailable,
// and shared by the static entry page, asynchronous loader and fully rendered UI.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync('public/index.html','utf8');
const app=fs.readFileSync('public/app.js','utf8');
const bootstrap=fs.readFileSync('public/bootstrap.js','utf8');
const catalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const about=JSON.parse(fs.readFileSync('public/about.json','utf8'));
const allArticles=JSON.parse(fs.readFileSync('public/articles.json','utf8'));
const articleIds=['album_sunshower','person_tatsuro_yamashita','song_plastic_love'];
const articles=articleIds.map(id=>{const article=allArticles.find(a=>a.entityId===id);assert(article,id+' has a real article');return article});
// Actual source records, bounded to keep this selection matrix inexpensive. The other
// DOM suites exercise the full catalog, and editorial suites validate all articles.
const ids=new Set([...articleIds,'album_variety','person_taeko_ohnuki','person_mariya_takeuchi']);
const data={...catalog,nodes:catalog.nodes.filter(n=>ids.has(n.id)),edges:catalog.edges.filter(e=>ids.has(e.source)&&ids.has(e.target))};
const key='citypop-language';
const copy={
 en:{html:'en',nav:['Explore the graph','Records & people','About City Pop','Review candidates'],heading:'The City Pop archive',subtitle:'Follow a song to its artist, record and creative collaborators. A sourced, representative collection—not a complete catalogue.',catalog:'The music archive',guide:'City Pop has no single fixed boundary',gate:'Administrator sign-in',loading:'Loading archive…',scriptError:'The page could not load. Please reload.',dataError:'The archive is temporarily unavailable. Please reload.'},
 zh:{html:'zh-CN',nav:['图谱探索','唱片与人物','关于 City Pop','采集审核'],heading:'日本 City Pop 音乐档案',subtitle:'从一首歌出发，认识背后的歌手、唱片与创作者。代表性资料集，逐条保留来源。',catalog:'音乐档案',guide:'City Pop 没有一条固定的边界',gate:'管理员登录',loading:'正在读取音乐档案…',scriptError:'页面加载失败，请刷新重试',dataError:'资料库暂时无法连接，请刷新重试'},
 ja:{html:'ja',nav:['グラフを探索','レコードと人物','シティポップとは','収集レビュー'],heading:'シティポップ・アーカイブ',subtitle:'一曲から、歌い手、レコード、作り手へ。出典をたどれる代表的なコレクションです。網羅的な目録ではありません。',catalog:'音楽アーカイブ',guide:'シティポップの境界は、一つではありません',gate:'管理者ログイン',loading:'アーカイブを読み込み中…',scriptError:'ページを読み込めませんでした。再読み込みしてください。',dataError:'アーカイブに接続できません。再読み込みしてください。'}
};
const flush=async()=>{for(let i=0;i<3;i++)await new Promise(setImmediate)};
const response=(body,status=200)=>({ok:status===200,status,json:async()=>structuredClone(body)});
let checks=0;
function make({saved=null,browser='zh-CN',denied=null,denySet=false,url='https://citypop.test/'}={}){
 const errors=[];
 const console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error));
 const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console}),w=dom.window,d=w.document;
 Object.defineProperty(w.navigator,'language',{get:()=>browser});
 Object.defineProperty(w.navigator,'languages',{get:()=>[browser,'ja-JP','zh-CN']});
 if(saved!==null)w.localStorage.setItem(key,saved);
 if(denied==='getter')Object.defineProperty(w,'localStorage',{get(){throw new w.DOMException('Storage blocked','SecurityError')}});
 if(denied==='read')w.Storage.prototype.getItem=()=>{throw new w.DOMException('Storage blocked','SecurityError')};
 if(denySet)w.Storage.prototype.setItem=()=>{throw new w.DOMException('Storage quota exceeded','QuotaExceededError')};
 w.DATA=structuredClone(data);w.ARTICLES=structuredClone(articles);w.ABOUT=structuredClone(about);
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:t=>({width:t.length*7})},{get:(o,k)=>o[k]||(()=>{})});
 w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:1000,height:700,left:0,top:0});
 w.HTMLCanvasElement.prototype.setPointerCapture=()=>{};
 w.matchMedia=()=>({matches:false});w.scrollTo=()=>{};w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
 const calls=[];w.fetch=async(path,options={})=>{calls.push({path,options});assert.equal(path,'/api/review-session','An unauthorized review must only fetch the access gate');return response({state:'signed-out',canReview:false})};
 return {dom,w,d,errors,calls,run:()=>vm.runInContext(app,dom.getInternalVMContext()),boot:()=>vm.runInContext(bootstrap,dom.getInternalVMContext()),click:s=>{const el=d.querySelector(s);assert(el,s);el.click()},close:()=>{assert.deepEqual(errors,[],'No uncaught DOM errors');w.close()}};
}
function assertUI(s,locale,view='graph'){
 const {d}=s,c=copy[locale];
 assert.equal(d.documentElement.lang,c.html);
 assert.equal(d.body.dataset.view,view);
 assert.equal(d.querySelector('#heading').textContent,c.heading);
 assert.equal(d.querySelector('#subtitle').textContent,c.subtitle);
 assert.deepEqual([...d.querySelectorAll('#nav [data-view]')].map(b=>b.textContent),c.nav);
 assert.equal(d.querySelector('meta[name="description"]').content,c.subtitle);
 assert.equal(d.title,'City Pop Atlas · '+c.nav[['graph','catalog','guide','review'].indexOf(view)]);
 assert.deepEqual([...d.querySelectorAll('[data-lang][aria-pressed="true"]')].map(b=>b.dataset.lang),[locale]);
 assert.deepEqual([...d.querySelectorAll('[data-lang].active')].map(b=>b.dataset.lang),[locale]);
 assert(!d.title.includes('undefined'));
 checks++;
}
function assertLoader(s,locale,message='loading'){
 const c=copy[locale];assert.equal(s.d.documentElement.lang,c.html);assert.equal(s.d.title,'City Pop Atlas · '+c.nav[0]);assert.equal(s.d.querySelector('#load-status').textContent,c[message]);assert(s.d.body.classList.contains('loading'));checks++;
}
(async()=>{
 // Static HTML is useful before any JavaScript or storage access succeeds.
 let s=make();assert.equal(s.d.documentElement.lang,'en');assert.equal(s.d.title,'City Pop Atlas · Explore the graph');assert.equal(s.d.querySelector('#load-status').textContent,copy.en.loading);assert.equal(s.d.querySelector('#load-status').getAttribute('role'),'status');assert.equal(s.d.querySelector('.skip-link').textContent,'Skip to search');assert.match(s.d.querySelector('meta[name="description"]').content,/^Explore Japanese City Pop/);s.close();checks++;
 // Neither navigator.language, navigator.languages, a URL query nor a fragment is
 // a preference. Existing ?view=review routing is covered separately below.
 for(const browser of ['en-US','zh-CN','zh-TW','ja-JP','fr-FR']){
  s=make({browser,url:'https://citypop.test/?lang=ja&language=zh#lang=zh'});s.run();assertUI(s,'en');assert.equal(s.w.localStorage.getItem(key),null,'First visit must not overwrite a preference');s.close();
 }
 for(const saved of [null,'','fr','__proto__','constructor','toString','EN','zh-CN',' en ','null']){
  s=make({saved});s.run();assertUI(s,'en');assert.equal(s.w.localStorage.getItem(key),saved,'Invalid storage is ignored, not rewritten');s.close();
 }
 for(const denied of ['getter','read']){s=make({denied});s.run();assertUI(s,'en');s.click('[data-lang="ja"]');assertUI(s,'ja');s.click('[data-lang="zh"]');assertUI(s,'zh');s.close()}
 // Valid saved preferences win over browser/URL language and survive a new document.
 for(const locale of ['zh','en','ja']){
  for(let reload=0;reload<2;reload++){s=make({saved:locale,browser:locale==='ja'?'zh-CN':'ja-JP',url:'https://citypop.test/?lang=fr'});s.run();assertUI(s,locale);assert.equal(s.w.localStorage.getItem(key),locale);s.close()}
 }
 s=make();s.run();
 for(const locale of ['zh','en','ja','ja','en']){s.click(`[data-lang="${locale}"]`);assertUI(s,locale);assert.equal(s.w.localStorage.getItem(key),locale);const reloaded=make({saved:s.w.localStorage.getItem(key)});reloaded.run();assertUI(reloaded,locale);reloaded.close()}
 s.w.localStorage.removeItem(key);s.close();s=make();s.run();assertUI(s,'en');s.close();
 s=make({saved:'zh',denySet:true});s.run();assertUI(s,'zh');s.click('[data-lang="ja"]');assertUI(s,'ja');assert.equal(s.w.localStorage.getItem(key),'zh','Failed persistence must not prevent the in-session switch');s.close();s=make({saved:'zh'});s.run();assertUI(s,'zh');s.close();
 // Switch in-place on each view, checking headings, title and metadata as well as
 // active buttons. Review remains gated, independent of interface language.
 s=make();s.run();
 for(const view of ['graph','catalog','guide','review']){
  s.click(`[data-view="${view}"]`);await flush();
  for(const locale of ['en','zh','ja']){
   s.click(`[data-lang="${locale}"]`);await flush();assertUI(s,locale,view);
   if(view==='catalog'){assert.equal(s.d.querySelector('#catalog-title').textContent,copy[locale].catalog);assert(s.d.querySelector('#cards .card'))}
   if(view==='guide')assert.equal(s.d.querySelector('#guide h1').textContent,about.locales[locale].title);
   if(view==='review'){assert.equal(s.d.querySelector('.admin-gate h2').textContent,copy[locale].gate);assert(!s.d.querySelector('.review-card'));assert(!s.d.querySelector('#operations'));assert.equal(s.d.querySelector('.admin-signin').target,'_top')}
  }
 }
 assert.deepEqual(s.calls.map(c=>c.path),['/api/review-session']);s.close();
 for(const locale of ['en','zh','ja']){s=make({saved:locale,url:'https://citypop.test/?view=review&lang=fr'});s.run();await flush();assertUI(s,locale,'review');assert.equal(s.d.querySelector('.admin-gate h2').textContent,copy[locale].gate);assert.deepEqual(s.calls.map(c=>c.path),['/api/review-session']);s.close()}
 // Real person, album and song editorial copy remains multilingual. Back resets
 // article-specific title/description to the catalog while retaining the language.
 s=make();s.run();s.click('[data-view="catalog"]');
 for(const article of articles){
  s.w.openArticle(article.entityId);
  for(const locale of ['en','zh','ja']){
   s.click(`[data-lang="${locale}"]`);const c=article.locales[locale];assert.equal(s.d.body.dataset.view,'article');assert.equal(s.d.querySelector('#article-view h1').textContent,c.title);assert.equal(s.d.title,c.title+' · City Pop Atlas');assert.equal(s.d.querySelector('meta[name="description"]').content,c.dek);assert.equal(s.d.documentElement.lang,copy[locale].html);assert.equal(s.d.querySelector('.essay-body').lang,copy[locale].html);assert.deepEqual([...s.d.querySelectorAll('.essay-body p')].map(p=>p.textContent),c.paragraphs);checks++;
  }
  s.click('#article-back');assertUI(s,'ja','catalog');
 }
 s.close();
 // Bootstrap covers every preference fallback before network completion and app
 // execution, including browser language and denied storage. Its success/error
 // handlers keep localized status without requesting protected review endpoints.
 const starts=[...['en-US','zh-CN','ja-JP'].map(browser=>({browser})),...['','fr','__proto__','constructor'].map(saved=>({saved})),{denied:'getter'},{denied:'read'},...['zh','en','ja'].map(saved=>({saved}))];
 for(const options of starts){s=make(options);s.w.fetch=()=>new Promise(()=>{});s.boot();assertLoader(s,['zh','en','ja'].includes(options.saved)?options.saved:'en');s.close()}
 for(const locale of ['en','zh','ja']){
  for(const failure of ['network','http','shape','json','articles-http','articles-json']){
   s=make({saved:locale});const calls=[];s.w.fetch=async path=>{calls.push(path);if(path==='/api/graph'){if(failure==='network')throw Error('offline');if(failure==='http')return response({},503);if(failure==='shape')return response({nodes:{},edges:[]});if(failure==='json')return {ok:true,json:async()=>{throw Error('malformed JSON')}};return response(data)}if(failure==='articles-json')return {ok:true,json:async()=>{throw Error('malformed articles')}};return response([],503)};
   await s.boot();assertLoader(s,locale,'dataError');assert(!s.d.querySelector('script[src^="/app.js"]'));assert.deepEqual(calls,failure.startsWith('articles-')?['/api/graph','/articles.json']:['/api/graph']);s.close();
  }
  s=make({saved:locale});const calls=[];s.w.fetch=async(path,options)=>{calls.push([path,options.cache]);return response(path==='/api/graph'?data:path==='/about.json'?about:articles)};await s.boot();assertLoader(s,locale);assert.deepEqual(calls,[['/api/graph','no-store'],['/articles.json','no-store'],['/about.json','no-store']]);const script=s.d.querySelector('script[src^="/app.js"]');assert(script);script.dispatchEvent(new s.w.Event('error'));assertLoader(s,locale,'scriptError');s.close();
  s=make({saved:locale});s.w.fetch=async path=>response(path==='/api/graph'?data:path==='/about.json'?about:articles);await s.boot();assertLoader(s,locale);s.run();s.d.querySelector('script[src^="/app.js"]').dispatchEvent(new s.w.Event('load'));assert(!s.d.querySelector('#load-status'));assert(!s.d.body.classList.contains('loading'));assertUI(s,locale);s.close();
 }
 console.log(`PASS locale regression: ${checks} checked UI/loader states; static English, navigator-independent default, invalid/prototype values, denied reads/writes, persisted choices/reloads, graph/catalog/guide/review, real trilingual essays and loading/network/data/script errors`);
})().catch(error=>{console.error(error);process.exitCode=1});
