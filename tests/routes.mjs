import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../public/routes.js';
const R=globalThis.CityPopRoutes;
const catalog=JSON.parse(fs.readFileSync('data/catalog.json'));
assert.equal(R.homePath(),' /en/'.trim());
assert.equal(R.aboutPath('ja'),'/ja/about');
assert.equal(R.browsePath('zh','album',2),'/zh/browse/albums/page/2');
assert.throws(()=>R.pathFor({id:'a',type:'constructor'}));
assert.throws(()=>R.homePath('fr'));
assert.throws(()=>R.browsePath('en',null,2));
assert.throws(()=>R.browsePath('en','album',0));
assert.throws(()=>R.browsePath('en','album',Infinity));
for(const lang of R.languages){
 const seen=new Set();
 for(const node of catalog.nodes){
  const path=R.pathFor(node,lang);assert(!seen.has(path),'Unique stable URL: '+path);seen.add(path);
  const route=R.parsePath(path,catalog);assert.equal(route.kind,'entity');assert.equal(route.node.id,node.id);assert.equal(route.lang,lang);assert.equal(route.redirect,undefined);
  assert.equal(R.pathFor({...node,labels:{en:'Completely renamed',zh:'改名',ja:'改名'}},lang),path);
 }
 assert.equal(R.parsePath('/'+lang,catalog).redirect,R.homePath(lang));
 assert.equal(R.parsePath('/'+lang+'/about/',catalog).redirect,R.aboutPath(lang));
 assert.equal(R.parsePath('/'+lang+'/browse/albums/page/1',catalog).redirect,R.browsePath(lang,'album'));
}
const alias=R.parsePath('/en/albums/album-timely-2008',catalog);
assert.equal(alias.entityId,'edition_timely_2008_flcf4243');assert.equal(alias.redirect,R.pathFor(catalog.nodes.find(n=>n.id===alias.entityId)));
const ids=['person_a_b','person_a-b','person_a~hb','person_a/b','person_a%b','person_a b','person_a😀b','person_A_b'];
const adversarial={nodes:ids.map(id=>({id,type:'artist'})),entityAliases:{old:'loop',loop:'old'}};
const paths=adversarial.nodes.map(n=>R.pathFor(n));assert.equal(new Set(paths).size,ids.length);
for(let i=0;i<paths.length;i++)assert.equal(R.parsePath(paths[i],adversarial).entityId,ids[i]);
for(const path of ['/','/EN/','/en/ARTISTS/person-tatsuro-yamashita','/fr/about','//en/','/en//about','/en/about//','/en/about?x=1','/en/about#x','/en/%','/en/%2Fabout','/en/%5cabout','/en/%00about','/en/../about','/en/%2e%2e/about','/en/browse/albums/page/0','/en/browse/albums/page/01','/en/browse/albums/page/9007199254740992','/en/artists/nonexistent','/en/toString/x'])assert.equal(R.parsePath(path,catalog),null,path);
assert.equal(R.parsePath('/en/%61bout',catalog).redirect,'/en/about');
const browser={};vm.runInNewContext(fs.readFileSync('public/routes.js','utf8'),browser);assert.equal(browser.CityPopRoutes.pathFor(catalog.nodes[0]),R.pathFor(catalog.nodes[0]));
console.log(`PASS shared browser/server stable routes, ${catalog.nodes.length*3} round trips, labels, collisions, aliases, malformed paths`);
