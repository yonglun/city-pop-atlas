const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert'),vm=require('vm');
const data=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const dom=new JSDOM(fs.readFileSync('public/index.html','utf8'),{url:'https://citypop.test',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,d=w.document;w.DATA=data;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:t=>({width:t.length*7})},{get:(o,k)=>o[k]||(()=>{})});let frames=[];w.requestAnimationFrame=f=>{frames.push(f);return frames.length};w.cancelAnimationFrame=()=>{};let scrollTop=0;w.scrollTo=opts=>{scrollTop=opts.top};const tick=()=>{const q=frames;frames=[];q.forEach(f=>f())};
vm.runInContext(fs.readFileSync('public/app.js','utf8'),dom.getInternalVMContext());
const click=s=>d.querySelector(s).click(),change=(s,value)=>{d.querySelector(s).value=value;d.querySelector(s).dispatchEvent(new w.Event('change'))};
click('#nav [data-view="catalog"]');
assert.equal(d.querySelectorAll('.card').length,24);assert([...d.querySelectorAll('.card')].every(c=>data.nodes.find(n=>n.id===c.dataset.entry).type==='album'));assert(d.querySelectorAll('#cards iframe').length>0);
const existingPlayer=d.querySelector('#cards iframe');click('#more-cards');assert(existingPlayer.isConnected);assert.equal(d.querySelectorAll('.card').length,data.nodes.filter(n=>n.type==='album').length);
change('#catalog-sort','oldest');assert.equal(d.activeElement.id,'catalog-sort');let years=[...d.querySelectorAll('.card')].map(c=>data.nodes.find(n=>n.id===c.dataset.entry).year).filter(Boolean);assert.deepEqual(years,[...years].sort((a,b)=>a-b));
change('#media-filter','players');assert.equal(d.activeElement.id,'media-filter');assert([...d.querySelectorAll('.card')].every(c=>c.querySelector('iframe')));
const first=d.querySelector('.card').dataset.entry;Object.defineProperty(w,'scrollY',{value:780,configurable:true});click('.card .card-open');assert.equal(scrollTop,0);assert(d.querySelector('#back-catalog'));assert.equal(d.querySelectorAll('#cards iframe').length,0);assert.equal(d.querySelectorAll('#detail iframe').length,1);click('#back-catalog');tick();assert.equal(scrollTop,780);assert.equal(d.activeElement.dataset.id,first);assert.equal(d.body.dataset.view,'catalog');assert.equal(d.querySelector('#media-filter').value,'players');assert.equal(d.querySelector('#catalog-sort').value,'oldest');assert(d.querySelector(`[data-entry="${first}"]`));assert.equal(d.querySelectorAll('#detail iframe').length,0);
click('[data-group="people"]');change('#media-filter','portraits');assert.equal(d.querySelectorAll('.card').length,data.nodes.filter(n=>['artist','person'].includes(n.type)&&(n.media?.some(m=>m.status==='verified')||n.portraitEmbed?.status==='verified')).length);assert(d.querySelector('.card img'));d.querySelector('.card img').dispatchEvent(new w.Event('error'));assert(d.querySelector('.image-fallback'));
click('[data-group="all"]');change('#media-filter','youtube');assert(d.querySelector('.card-links a[href*="youtube.com/watch"]'));assert([...d.querySelectorAll('.card')].every(c=>c.querySelector('a[href*="youtube.com/watch"]')));
for(const lang of ['en','ja','zh']){click(`[data-lang="${lang}"]`);assert.equal(d.querySelector('#media-filter').value,'youtube');assert(d.querySelector('#catalog-controls').textContent.length>20)}
d.querySelector('#search').value='__no_such_record__';d.querySelector('#search').dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('.card').length,0);click('#reset-catalog');assert.equal(d.querySelectorAll('.card').length,24);assert.equal(d.querySelector('#search').value,'');
d.querySelector('#search').value='大貫妙子';d.querySelector('#search').dispatchEvent(new w.Event('input'));assert(d.querySelector('[data-entry="album_sunshower"]'));click('#clear');
click('#nav [data-view="graph"]');assert.equal(d.querySelectorAll('#cards iframe').length,0);assert.equal(d.querySelectorAll('#cards .card').length,0);
change('#type','person');click('#nav [data-view="catalog"]');assert(d.querySelectorAll('.card').length>0);assert([...d.querySelectorAll('.card')].every(c=>data.nodes.find(n=>n.id===c.dataset.entry).type==='person'));

// Verify new edition detail lists and all three visible qualification languages.
const batchEditions=JSON.parse(fs.readFileSync('docs/COLLECTION-2026-10-03-SIX-EDITIONS.json','utf8')).editions;
for(const locale of ['zh','en','ja']){
 click(`[data-lang="${locale}"]`);
 for(const spec of batchEditions){
  w.eval(`select(${JSON.stringify(spec.id)})`);
  const entity=data.nodes.find(n=>n.id===spec.id),tracks=data.nodes.filter(n=>n.editionId===spec.id).sort((a,b)=>a.position-b.position);
  assert(d.querySelector('#detail').textContent.includes(entity.description[locale]),spec.id+' localized scope');
  const buttons=[...d.querySelectorAll('.edition-tracks button')];assert.equal(buttons.length,tracks.length);
  buttons.forEach((button,i)=>assert(button.textContent.includes(tracks[i].labels[locale]),spec.id+' ordered track '+i));
  assert(d.querySelector('.fact-note').textContent.length>10,'Visible date scope note');
 }
 w.eval('select("edition_twilight_zone_2020_mhcl10126_track_05")');
 assert(d.querySelector('#detail').textContent.includes(data.nodes.find(n=>n.id==='edition_twilight_zone_2020_mhcl10126_track_05').attributes.recordingVersion.noteLabels[locale]));
 w.eval('select("edition_down_town_2024_mhcl31017_track_06")');
 assert(d.querySelector('#detail').textContent.includes(data.nodes.find(n=>n.id==='edition_down_town_2024_mhcl31017_track_06').description[locale]));
}
console.log('PASS all six edition track lists and visible date/version/composite-title qualifications in Chinese, English and Japanese');


// Every newly collected edition and slot must show its qualification in each locale.
const moreEditions=JSON.parse(fs.readFileSync('docs/COLLECTION-2026-10-03-MORE-EDITIONS.json','utf8')).editions;
let newViews=0;
for(const locale of ['zh','en','ja']){
 click(`[data-lang="${locale}"]`);
 for(const spec of moreEditions){
  const edition=data.nodes.find(n=>n.id===spec.id),tracks=data.nodes.filter(n=>n.editionId===spec.id).sort((a,b)=>a.position-b.position);
  for(const entity of [edition,...tracks]){
   w.eval(`select(${JSON.stringify(entity.id)})`);newViews++;
   const detail=d.querySelector('#detail');assert(detail.textContent.includes(entity.description[locale]),entity.id+' visible description '+locale);
   for(const attribute of Object.values(entity.attributes))if(attribute.noteLabels)assert(detail.textContent.includes(attribute.noteLabels[locale]),entity.id+' visible qualification '+locale);
   assert.equal(detail.querySelectorAll('iframe').length,0,'No inherited exact-edition player');
  }
  w.eval(`select(${JSON.stringify(spec.id)})`);
  const buttons=[...d.querySelectorAll('.edition-tracks button')];assert.equal(buttons.length,tracks.length);
  buttons.forEach((button,i)=>assert(button.textContent.includes(tracks[i].labels[locale]),spec.id+' source-ordered title '+i));
 }
}
assert.equal(newViews,222);
console.log('PASS 222 new edition/slot locale views, LP side order and visible remaster/live/bonus qualifications');

dom.window.close();console.log('PASS catalog categories, bounded rendering, media filters, sort, visible lazy players, back state, empty state and translations');
