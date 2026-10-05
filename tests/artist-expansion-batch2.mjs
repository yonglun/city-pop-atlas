import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const d=JSON.parse(fs.readFileSync('data/catalog.json'));
const a=JSON.parse(fs.readFileSync('public/articles.json'));
const m=JSON.parse(fs.readFileSync('docs/COLLECTION-2026-10-05-ARTISTS-BATCH2.json'));
const idx=new Map(d.nodes.map(n=>[n.id,n])),articles=new Map(a.map(x=>[x.entityId,x]));
const artists=['person_yurie_kokubu','person_cindy','person_mari_iijima','person_rajie','person_kaoru_sudo'];
const albums=['album_relief_72_hours','album_angel_touch','album_rose','album_heart_to_heart','album_chefs_special'];
const songs=['song_tobashite_taxi_man','song_surprise_cindy','song_blueberry_jam','song_hold_me_tight','song_anata_dake_i_love_you'];
const expectedCore=[...artists,...albums,...songs];
assert.deepEqual(new Set(m.newCoreIds),new Set(expectedCore));
assert.equal(m.newCoreIds.length,15);assert.equal(m.editions.length,5);
assert.deepEqual(Object.fromEntries(m.editions.map(e=>[e.id,e.tracks.length])),{edition_relief_72_hours_2013_mhcl30150:10,edition_angel_touch_2020_dqjl7116:11,edition_rose_2007_vicl62217:11,edition_heart_to_heart_2005_mhcl644:10,edition_chefs_special_2007_mhcl1139:14});
assert.deepEqual(m.baseCounts,{nodes:910,edges:1299,articles:910});
// Later additive collections preserve this batch while increasing global totals.
assert(d.nodes.length>=910+m.newNodeIds.length);assert(d.edges.length>=1299+m.newEdgeIds.length);
assert.equal(a.length,d.nodes.length);assert(a.filter(x=>x.kind!=='contextual').length>=162);
assert(d.nodes.filter(n=>['artist','person'].includes(n.type)).length>=53);
assert(d.nodes.filter(n=>n.type==='album').length>=52);assert(d.nodes.filter(n=>n.type==='song').length>=57);
assert(d.nodes.filter(n=>n.type==='edition').length>=61);
assert.equal(d.nodes.filter(n=>n.type==='work').length,53);assert.equal(d.nodes.filter(n=>n.type==='recording').length,54);
let trackCount=0;const artHashes=new Set();
for(const id of m.newNodeIds){
 const n=idx.get(id);assert(n);assert(n.sources.length);assert.equal(n.media.length,0,'No unlicensed third-party images imported');
 assert.equal(new Set(n.aliases).size,n.aliases.length);for(const l of ['en','zh','ja'])assert(n.labels[l]&&n.description[l]&&articles.get(id).locales[l]);
 for(const value of Object.values(n.attributes)){assert(value.sourceUrl&&value.sourceType&&value.checkedAt);assert(n.sources.includes(value.sourceUrl));assert.equal(value.checkedAt,'2026-10-05');if(value.noteLabels)for(const l of ['en','zh','ja'])assert(value.noteLabels[l]);}
 for(const link of n.serviceLinks){assert.equal(link.status,'verified');assert.equal(link.verification.playbackVerified,false);assert.equal(link.verification.regionAvailabilityVerified,false);assert.equal(link.verification.audioMasterEquivalenceVerified,false);if(link.version)for(const l of ['en','zh','ja'])assert(link.versionLabels?.[l]);}
 if(n.type==='track'){assert.equal(n.recordingId,null);assert.equal(n.serviceLinks.length,0);assert.equal(n.attributes.durationMs,undefined);}
}
for(const id of expectedCore){
 const article=articles.get(id);assert.notEqual(article.kind,'contextual');assert.equal(article.illustration.src,'/illustrations/'+id+'.webp');
 const bytes=fs.readFileSync('public'+article.illustration.src);const hash=crypto.createHash('sha256').update(bytes).digest('hex');assert(!artHashes.has(hash));artHashes.add(hash);
 for(const l of ['zh','en','ja']){const c=article.locales[l];assert(c.paragraphs.length>=5);const length=l==='en'?c.paragraphs.join(' ').split(/\s+/).length:[...c.paragraphs.join('')].length;assert(length>=({zh:650,en:350,ja:750})[l],id+' '+l+' substantive essay');assert(c.caption.includes('AI'));assert(!/\b(?:TODO|TBD|lorem ipsum)\b/i.test(c.paragraphs.join(' ')));}
}
assert.equal(artHashes.size,15);
for(const s of m.editions){
 const n=idx.get(s.id);assert.equal(n.albumId,s.albumId);assert.equal(n.attributes.releaseDate.value,s.releaseDate);assert.equal(n.attributes.catalogNumber.value,s.catalogNumber);
 const tracks=d.nodes.filter(n=>n.editionId===s.id).sort((a,b)=>a.position-b.position);trackCount+=tracks.length;
 assert.deepEqual(tracks.map(n=>({position:n.position,slotLabel:n.slotLabel,title:n.attributes.trackTitle.value})),s.tracks.map(t=>({position:t.position,slotLabel:t.slotLabel||String(t.position),title:t.title})));
 for(const x of [n,...tracks]){const article=articles.get(x.id);assert.equal(article.canonicalEntityId,s.albumId);assert(article.illustration.shared);assert.equal(article.illustration.src,articles.get(s.albumId).illustration.src);assert.equal(article.locales.en.paragraphs.length,3);}
}
assert.equal(trackCount,56);assert.equal(m.newNodeIds.length,76);assert(d.nodes.length>=986);assert.equal(m.newNodeIds.length,20+trackCount);assert(d.nodes.filter(n=>n.type==='track').length>=600+trackCount);
assert(idx.has('person_kaoru_akimoto'));assert.notEqual(idx.get('person_kaoru_sudo').originalJapanese,idx.get('person_kaoru_akimoto').originalJapanese);
for(const id of artists){assert.equal(idx.get(id).type,'artist');assert(d.edges.some(e=>e.source===id&&e.type==='released'&&albums.includes(e.target)));}
for(const id of songs){assert.equal(idx.get(id).type,'song');assert(d.nodes.some(n=>n.type==='track'&&n.compositionEntryId===id));assert(d.edges.some(e=>e.target===id&&e.type==='performer'&&artists.includes(e.source)));}
for(const role of ['lyricist','composer','arranger'])assert(d.edges.some(e=>e.source==='person_eiichi_ohtaki'&&e.target==='song_anata_dake_i_love_you'&&e.type===role));
assert(d.edges.some(e=>e.source==='person_ryuichi_sakamoto'&&e.target==='album_rose'));
assert(d.edges.some(e=>e.source==='person_tetsuji_hayashi'&&e.target==='album_relief_72_hours'));
assert(d.edges.some(e=>e.source==='person_tsugutoshi_goto'&&e.target==='album_heart_to_heart'));
console.log(`PASS batch2: 5 genuinely new singers, 5 albums, 5 songs, 5 exact issues and ${trackCount} ordered positions; 15 unique illustrated trilingual essays and source-scoped collaborations`);
