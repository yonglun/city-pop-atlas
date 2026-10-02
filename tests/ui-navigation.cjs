const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert'),vm=require('vm');
const data=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const dom=new JSDOM(fs.readFileSync('public/index.html','utf8'),{url:'https://citypop.test',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,d=w.document;w.DATA=data;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:t=>({width:t.length*7})},{get:(o,k)=>o[k]||(()=>{})});let frames=[];w.requestAnimationFrame=f=>{frames.push(f);return frames.length};w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};
vm.runInContext(fs.readFileSync('public/app.js','utf8'),dom.getInternalVMContext());
const click=s=>{assert(d.querySelector(s),s);d.querySelector(s).click()},select=id=>w.eval(`select(${JSON.stringify(id)})`),related=id=>click(`#detail [data-related="${id}"]`);
click('[data-lang="en"]');select('song_plastic_love');
const mariya=d.querySelectorAll('#detail [data-related="person_mariya_takeuchi"]');assert.equal(mariya.length,1);for(const role of ['Performed','Lyrics','Music'])assert(mariya[0].textContent.includes(role));
assert(d.querySelector('.connection-browser').compareDocumentPosition(d.querySelector('.facts'))&w.Node.DOCUMENT_POSITION_FOLLOWING);
assert(d.querySelector('.connection-entry .edition-context').textContent.includes('WPCL-12007'));
const shell=d.querySelector('.detail-shell');shell.scrollTop=320;related('person_mariya_takeuchi');assert.equal(shell.scrollTop,0);assert(d.querySelector('#back-entry').textContent.includes('Plastic Love'));assert.equal(d.activeElement.tagName,'H2');
const filter=d.querySelector('#credit-filter');filter.value='composer';filter.dispatchEvent(new w.Event('change'));assert.equal(d.activeElement.id,'credit-filter');assert([...d.querySelectorAll('.connection-entry')].every(b=>b.querySelector('.credit-roles').textContent.includes('Music')));
related('song_plastic_love');click('#back-entry');assert.equal(d.querySelector('#credit-filter').value,'composer');click('#back-entry');assert.equal(shell.scrollTop,320);assert.equal(d.activeElement.dataset.related,'person_mariya_takeuchi');assert(!d.querySelector('#back-entry'));
select('album_sunshower');related('edition_sunshower_1977_gw4029');assert.equal(d.querySelectorAll('.edition-tracks button').length,10);assert.equal(d.querySelectorAll('[data-related="edition_sunshower_1977_gw4029_track_a1"]').length,1);assert(d.querySelector('[data-related="album_sunshower"]'));related('edition_sunshower_1977_gw4029_track_a1');assert(d.querySelector('[data-related="song_summer_connection"]'));assert(d.querySelector('[data-related="edition_sunshower_1977_gw4029"]'));
// No invented identity links from a slot to the lone unrelated recording.
assert(!d.querySelector('.connection-entry[data-related^="recording_"]'));related('song_summer_connection');related('work_summer_connection');assert(d.querySelector('[data-related="song_summer_connection"]'));
select('song_kimi_wa_tennenshoku');assert(d.querySelector('#detail').textContent.includes('多羅尾伴内'));
for(const lang of ['zh','ja','en']){click(`[data-lang="${lang}"]`);assert(!d.querySelector('#detail').textContent.includes('undefined'));assert(d.querySelector('.connection-browser').getAttribute('aria-label'))}
click('#close-detail');assert.equal(w.eval('detailHistory.length'),0);
// Nested navigation must preserve the initial catalog position and filters.
click('[data-view="catalog"]');const first=d.querySelector('.card').dataset.entry;click('.card .card-open');const next=d.querySelector('#detail [data-related]');next.click();assert(d.querySelector('#back-catalog'));click('#back-catalog');const q=frames;frames=[];q.forEach(f=>f());assert.equal(d.body.dataset.view,'catalog');assert.equal(d.activeElement.dataset.id,first);assert.equal(w.eval('detailHistory.length'),0);assert.equal(d.querySelectorAll('#detail iframe').length,0);
dom.window.close();console.log('PASS grouped credits, role filtering, nested detail history/scroll/focus, edition identity, translations and archive return');
