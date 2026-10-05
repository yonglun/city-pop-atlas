import fs from 'node:fs';import assert from 'node:assert/strict';
const d=JSON.parse(fs.readFileSync('data/catalog.json')),f=JSON.parse(fs.readFileSync('tests/fixtures/artist-batch5-editions.json'));
let total=0;
for(const e of f.editions){
 const issue=d.nodes.find(n=>n.type==='edition'&&n.albumId===e.albumId&&n.attributes.catalogNumber?.value===e.catalogNumber);
 assert(issue,e.albumId+' independently sourced issue');assert.equal(issue.attributes.releaseDate.value,e.releaseDate);
 const slots=d.nodes.filter(n=>n.editionId===issue.id).sort((a,b)=>a.position-b.position);
 assert.deepEqual(slots.map(n=>n.attributes.trackTitle.value),e.discs.flat(),e.catalogNumber+' against independently transcribed source');
 if(e.discs.length>1){assert.equal(issue.attributes.discCount.value,e.discs.length);let pos=0;for(const [di,disc] of e.discs.entries())for(const [ti] of disc.entries()){const n=slots[pos++];assert.equal(n.attributes.discNumber.value,di+1);assert.equal(n.attributes.trackOnDisc.value,ti+1);}}
 if(e.catalogNumber==='MHCL-1123')for(const n of slots.slice(12)){assert.equal(n.attributes.trackKind.value,'bonus_track');assert(n.attributes.recordingVersion?.value.toLowerCase().includes('live'));}
 if(e.catalogNumber==='COCP-38334')assert.equal(slots[11].attributes.trackKind.value,'bonus_track');
 total+=slots.length;
}
assert.equal(total,68);console.log('PASS five independently sourced edition sequences: 68 exact titles, dates and catalog identities, dual-disc positions and explicit bonus variants');
