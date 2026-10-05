import assert from 'node:assert/strict';
import fs from 'node:fs';
const c=JSON.parse(fs.readFileSync('data/catalog.json'));
const idx=new Map(c.nodes.map(n=>[n.id,n]));
const specs=JSON.parse(fs.readFileSync('docs/COLLECTION-2026-10-05-CD-EDITIONS.json')).editions;
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/official-editions-2026-10-05-batch6.json'));
const articles=new Map(JSON.parse(fs.readFileSync('public/articles.json')).map(a=>[a.entityId,a]));
assert.equal(specs.length,6);let positions=0,bonuses=0;
for(const s of specs){
 const e=idx.get(s.id);assert.equal(e.albumId,s.albumId);
 for(const k of ['catalogNumber','releaseDate','format','trackCount','discCount','recordingVersion']) assert.equal(e.attributes[k].value,s[k]);
 const tracks=c.nodes.filter(n=>n.editionId===s.id).sort((a,b)=>a.position-b.position);positions+=tracks.length;
 assert.deepEqual(tracks.map(t=>({position:t.position,slotLabel:t.slotLabel,title:t.attributes.trackTitle.value,bonus:t.attributes.trackKind?.value==='bonus_track'})),fixture[s.id]);
 for(const n of [e,...tracks]){
  assert.equal(n.updatedAt,'2026-10-05');assert.equal(n.media.length,0);assert.equal(n.serviceLinks.length,0);assert.deepEqual(n.externalIds,{});
  for(const v of Object.values(n.attributes)){assert.equal(v.checkedAt,'2026-10-05');assert(['official','retailer'].includes(v.sourceType));assert(n.sources.includes(v.sourceUrl));if(v.noteLabels)for(const l of ['zh','en','ja'])assert(v.noteLabels[l]);}
  const a=articles.get(n.id);assert.equal(a.kind,'contextual');assert.equal(a.canonicalEntityId,s.albumId);assert.equal(a.illustration.shared,true);assert(a.sources.some(x=>x.url===e.attributes.releaseDate.sourceUrl),'Article must cite its edition date evidence');if(e.attributes.releaseDate.sourceType==='retailer')assert(a.locales.en.paragraphs.join(' ').toLowerCase().includes('retailer'),'Narrative preserves retailer evidence tier');assert.deepEqual(a.contextEvidence.authoredAttributes,Object.fromEntries(Object.entries(n.attributes).map(([k,v])=>[k,v.value])));
  for(const lang of ['zh','en','ja']){assert(n.description[lang]);assert(a.locales[lang].paragraphs.length===3);assert(a.locales[lang].paragraphs.join(' ').includes(s.catalogNumber));}
 }
 for(const t of tracks){assert.equal(t.recordingId,null);assert.equal(t.compositionEntryId,null);assert.equal(t.attributes.durationMs,undefined);if(t.attributes.trackKind?.value==='bonus_track')bonuses++;assert.equal(t.attributes.trackTitle.sourceType,'official');assert.equal(t.attributes.trackNumber.sourceType,'official');if(t.attributes.recordingVersion)assert.equal(t.attributes.recordingVersion.sourceType,'official','Track variant labels are official, not inherited edition-remaster metadata');assert(!c.edges.some(e=>e.target===t.id&&['performer','composer','lyricist','arranger','produced','records_work'].includes(e.type)));}
}
assert.equal(positions,65);assert.equal(bonuses,11);
for(const id of ['edition_ride_on_time_2002_bvcr17017','edition_spacy_2002_bvcr17014']) for(const field of ['releaseDate','format','discCount','recordingVersion','editionKind']){assert.equal(idx.get(id).attributes[field].sourceType,'retailer');assert(idx.get(id).attributes[field].sourceUrl.startsWith('https://www.cdjapan.co.jp/'));}
assert.equal(idx.get('edition_for_you_2002_bvcr17018').attributes.releaseDate.sourceType,'official');
assert.equal(idx.get('edition_for_you_2002_bvcr17018').attributes.trackCount.value,16);
assert.equal(c.nodes.filter(n=>n.editionId==='edition_for_you_2002_bvcr17018'&&n.attributes.trackKind?.value==='interlude').length,4);
assert(idx.get('edition_ride_on_time_2002_bvcr17017_track_04').attributes.trackTitle.value.includes('アルバム'));
assert(idx.get('edition_ride_on_time_2002_bvcr17017_track_10').attributes.trackTitle.value.includes('シングル'));
assert(!idx.get('edition_spacy_2002_bvcr17014_track_13').attributes.trackTitle.value.includes('未発表'));
assert(idx.get('edition_spacy_2002_bvcr17014_track_13').attributes.trackTitle.noteLabels.en.includes('does not mark'));
assert(articles.get('edition_ride_on_time_2002_bvcr17017').locales.en.paragraphs.join(' ').includes('12 tracks'));
for(const slug of ['seychelles','an_insatiable_high','t_wave']){const e=specs.find(s=>s.albumId==='album_'+slug);assert.equal(e.releaseDate,'2013-06-26');assert.equal(idx.get(e.id).attributes.recordingVersion.value,'2013 digital remaster');}
assert(c.nodes.length>=826);assert(c.edges.length>=1188);assert.equal(articles.size,c.nodes.length);
assert(c.nodes.filter(n=>n.type==='album').length>=41);assert(c.nodes.filter(n=>n.type==='song').length>=44);assert(c.nodes.filter(n=>n.type==='edition').length>=50);assert(c.nodes.filter(n=>n.type==='track').length>=541);
console.log('PASS batch6: 6 evidence-qualified CD editions, 65 exact official positions, 11 bonuses, 4 FOR YOU interludes, source tiers and variant boundaries, 71 trilingual shared-art introductions, no inferred identity or playback');
