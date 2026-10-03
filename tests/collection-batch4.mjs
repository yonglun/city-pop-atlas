import assert from 'node:assert/strict';import fs from 'node:fs';
const c=JSON.parse(fs.readFileSync('data/catalog.json')),idx=new Map(c.nodes.map(n=>[n.id,n]));
const specs=JSON.parse(fs.readFileSync('docs/COLLECTION-2026-10-03-EIGHT-EDITIONS.json')).editions;
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/official-editions-2026-10-03-batch4.json'));
assert.equal(specs.length,8);let slots=0,bonus=0;
for(const s of specs){const e=idx.get(s.id);assert.equal(e.albumId,s.albumId);for(const [k,v] of Object.entries({releaseDate:s.releaseDate,catalogNumber:s.catalogNumber,format:s.format,trackCount:s.trackCount}))assert.equal(e.attributes[k].value,v);
 const tracks=c.nodes.filter(n=>n.editionId===e.id).sort((a,b)=>a.position-b.position);slots+=tracks.length;
 assert.deepEqual(tracks.map(n=>({position:n.position,slotLabel:n.slotLabel,title:n.attributes.trackTitle.value})),fixture[e.id]);
 for(const n of [e,...tracks]){for(const a of Object.values(n.attributes)){assert.equal(a.sourceType,'official');assert.equal(a.checkedAt,'2026-10-03');assert(n.sources.includes(a.sourceUrl),n.id+' missing attribute source');if(a.noteLabels)for(const l of ['zh','en','ja'])assert(a.noteLabels[l]);}for(const l of ['zh','en','ja'])assert(n.description[l]);assert.equal(n.serviceLinks.length,0);assert.equal(n.media.length,0);assert.deepEqual(n.externalIds,{});}
 for(const n of tracks){assert.equal(n.compositionEntryId,null);assert.equal(n.recordingId,null);if(n.attributes.trackKind?.value==='bonus_track')bonus++;}
}
assert.equal(slots,99);assert.equal(bonus,14);
assert.deepEqual(c.nodes.filter(n=>n.editionId==='edition_songs_2025_srjl1170').map(n=>n.slotLabel),['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','B6']);
assert.deepEqual(c.nodes.filter(n=>n.editionId==='edition_kazemachi_roman_2023_mhjl293').map(n=>n.slotLabel),['A1','A2','A3','A4','A5','A6','B1','B2','B3','B4','B5','B6']);
assert(idx.get('edition_songs_2025_srjl1170_track_09').attributes.trackTitle.noteLabels.en.includes('this same LP'));
assert(idx.get('edition_tropical_dandy_2015_crcp20524_track_10').attributes.trackTitle.noteLabels.en.includes('one numbered position'));
for(const p of [11,12,13,14,15,16])assert(idx.get('edition_tropical_dandy_2015_crcp20524_track_'+p).attributes.trackTitle.noteLabels.en.includes('provenance'));
assert.equal(idx.get('edition_bon_voyage_co_2015_crcp20525_track_11').attributes.recordingVersion.value,'Single Version (1976)');
assert.equal(idx.get('edition_wish_2024_vicl77063_track_15').attributes.recordingVersion.value,'single version');
assert.equal(idx.get('edition_kazemachi_roman_2023_mhjl293').attributes.recordingVersion.value,'2023 Cutting');
for(const p of ['01','02','03','04','05','06','07','08'])assert.equal(idx.get('edition_solid_state_survivor_2018_mhcl10109_track_'+p).attributes.recordingVersion.value,'2018 Bob Ludwig Remastering');
assert.equal(idx.get('album_magical').year,1984);assert.equal(idx.get('edition_magical_2022_upcy90068').attributes.releaseDate.value,'2022-06-29');
assert.equal(idx.get('edition_tropical_dandy_2015_crcp20524').attributes.label,undefined);
assert.equal(idx.get('edition_bon_voyage_co_2015_crcp20525').attributes.label,undefined);
assert(new Set(c.nodes.filter(n=>n.type==='edition').map(n=>n.albumId)).size>=39,'Preserve batch4 album coverage');
for(const s of specs)assert(c.nodes.some(n=>n.type==='edition'&&n.albumId===s.albumId),'Preserve each batch4 edition');
console.log('PASS batch4: 8 exact editions, all 99 source-ordered slots, 14 bonuses, side/version/source discrepancy qualifications and unresolved identities');
