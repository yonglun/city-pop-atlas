import assert from 'node:assert/strict';import fs from 'node:fs';
const c=JSON.parse(fs.readFileSync('data/catalog.json')),idx=new Map(c.nodes.map(n=>[n.id,n]));
const specs=JSON.parse(fs.readFileSync('docs/COLLECTION-2026-10-03-PIPER-EDITIONS.json')).editions,fixture=JSON.parse(fs.readFileSync('tests/fixtures/official-editions-2026-10-03-batch5.json'));
assert.equal(specs.length,2);let slots=0;
for(const s of specs){const e=idx.get(s.id);assert.equal(e.albumId,s.albumId);
 for(const [k,v] of Object.entries({releaseDate:'2018-03-21',catalogNumber:s.catalogNumber,barcode:s.barcode,format:'CD',trackCount:10,discCount:1,label:'ヴィヴィド・サウンド',recordingVersion:'LVm (Laser Vinyl Master)',productionEdition:'limited paper sleeve edition'}))assert.equal(e.attributes[k].value,v);
 const tracks=c.nodes.filter(n=>n.editionId===e.id).sort((a,b)=>a.position-b.position);slots+=tracks.length;
 assert.deepEqual(tracks.map(n=>({position:n.position,slotLabel:n.slotLabel,title:n.attributes.trackTitle.value})),fixture[e.id]);
 for(const n of [e,...tracks]){assert.equal(n.year??2018,2018);for(const a of Object.values(n.attributes)){assert.equal(a.sourceType,'official');assert.equal(a.checkedAt,'2026-10-03');assert(n.sources.includes(a.sourceUrl));if(a.noteLabels)for(const l of ['zh','en','ja'])assert(a.noteLabels[l]);}for(const l of ['zh','en','ja'])assert(n.description[l]);assert.equal(n.serviceLinks.length,0);assert.equal(n.media.length,0);assert.deepEqual(n.externalIds,{});}
 for(const n of tracks){assert.equal(n.compositionEntryId,null);assert.equal(n.recordingId,null);assert.equal(n.attributes.durationMs,undefined);assert(!c.edges.some(e=>e.target===n.id&&['performer','composer','lyricist','arranger','produced'].includes(e.type)),'No inferred track credits');}
}
assert.equal(slots,20);assert.equal(idx.get('edition_sunshine_kiz_2018_ratcd4410_track_07').attributes.trackTitle.value,'Futari No Summer Time');
for(const l of ['zh','en','ja'])assert(idx.get('edition_sunshine_kiz_2018_ratcd4410_track_07').attributes.trackTitle.noteLabels[l]);
assert.equal(idx.get('album_summer_breeze').year,1983);assert(idx.get('album_summer_breeze').reviewNotes.some(n=>n.field==='year'&&n.status==='unresolved'));assert.equal(idx.get('album_sunshine_kiz').year,1984);
assert.equal(new Set(c.nodes.filter(n=>n.type==='edition').map(n=>n.albumId)).size,c.nodes.filter(n=>n.type==='album').length);assert.equal(c.nodes.filter(n=>n.type==='album'&&!c.nodes.some(e=>e.type==='edition'&&e.albumId===n.id)).length,0);
assert(c.nodes.filter(n=>n.type==='edition').length>=50);assert(c.nodes.filter(n=>n.type==='track').length>=541);
console.log('PASS batch5: 2 Vivid CDs, 20 exact track slots, barcode/packaging/LVm provenance, trilingual source boundaries; all albums covered');
