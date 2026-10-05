import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const d=JSON.parse(fs.readFileSync('data/catalog.json')),a=JSON.parse(fs.readFileSync('public/articles.json')),m=JSON.parse(fs.readFileSync('docs/COLLECTION-2026-10-05-ARTISTS-BATCH5.json'));
const idx=new Map(d.nodes.map(n=>[n.id,n])),articles=new Map(a.map(x=>[x.entityId,x]));
const artists=['person_yoshitaka_minami','person_masamichi_sugi','person_hiroshi_sato','person_noriyo_ikeda','person_mayo_shono'];
const albums=['album_speak_low','album_stargazer','album_awakening','album_dream_in_the_street','album_refrain_shono'];
const songs=['song_monroe_walk','song_vacance_wa_itsumo_rain','song_i_cant_wait_sato','song_dream_in_the_street','song_tonde_istanbul'];
const expectedCore=[...artists,...albums,...songs];
assert.deepEqual(new Set(m.newCoreIds),new Set(expectedCore));assert.equal(m.editions.length,5);
assert.deepEqual(m.baseCounts,{nodes:1138,edges:1593,articles:1138});
assert.equal(d.nodes.length,m.baseCounts.nodes+m.newNodeIds.length);assert.equal(d.edges.length,m.baseCounts.edges+m.newEdgeIds.length);
assert.equal(a.length,d.nodes.length);assert.equal(a.filter(x=>x.kind!=='contextual').length,208);
assert.equal(d.nodes.filter(n=>n.type==='artist').length,47);assert.equal(d.nodes.filter(n=>n.type==='person').length,21);
assert.equal(d.nodes.filter(n=>n.type==='album').length,67);assert.equal(d.nodes.filter(n=>n.type==='song').length,73);
assert.equal(d.nodes.filter(n=>n.type==='edition').length,76);assert.equal(d.nodes.filter(n=>n.type==='work').length,53);assert.equal(d.nodes.filter(n=>n.type==='recording').length,54);
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),artHashes=new Set(),proseHashes=new Set();let trackCount=0;
const oldPeople=d.nodes.filter(n=>['artist','person'].includes(n.type)&&!artists.includes(n.id));
const normalize=s=>s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
const names=n=>[...Object.values(n.labels),...(n.aliases||[])].map(normalize).filter(Boolean);
for(const id of artists){const n=idx.get(id);for(const old of oldPeople)assert(!names(n).some(x=>names(old).includes(x)),id+' is distinct from '+old.id);}
for(const id of m.newNodeIds){const n=idx.get(id);assert(n);assert(n.sources.length);assert.equal(n.media.length,0,'No unlicensed standalone images');assert.equal(new Set(n.aliases).size,n.aliases.length);
 for(const l of ['en','zh','ja'])assert(n.labels[l]&&n.description[l]&&articles.get(id).locales[l]);
 for(const value of Object.values(n.attributes)){assert(value.sourceUrl&&value.sourceType&&value.checkedAt);assert(n.sources.includes(value.sourceUrl));assert.equal(value.checkedAt,'2026-10-05');if(value.noteLabels)for(const l of ['en','zh','ja'])assert(value.noteLabels[l]);}
 for(const link of n.serviceLinks){assert.equal(link.status,'verified');assert.equal(link.verification.playbackVerified,false);assert.equal(link.verification.regionAvailabilityVerified,false);assert.equal(link.verification.audioMasterEquivalenceVerified,false);if(link.version)for(const l of ['en','zh','ja'])assert(link.versionLabels?.[l]);}
 if(n.type==='track'){assert.equal(n.recordingId,null);assert.equal(n.serviceLinks.length,0);assert.equal(n.attributes.durationMs,undefined);}
}
for(const id of expectedCore){const article=articles.get(id);assert.notEqual(article.kind,'contextual');assert.equal(article.illustration.src,'/illustrations/'+id+'.webp');
 const h=hash(fs.readFileSync('public'+article.illustration.src));assert(!artHashes.has(h));artHashes.add(h);assert.deepEqual(article.lyricQuotes,[]);
 for(const l of ['zh','en','ja']){const c=article.locales[l];assert(c.paragraphs.length>=6);const length=l==='en'?c.paragraphs.join(' ').split(/\s+/).length:[...c.paragraphs.join('')].length;assert(length>=({zh:1000,en:500,ja:1500})[l],id+' '+l+' substantial essay '+length);assert(c.caption.includes('AI'));assert(!/\b(?:TODO|TBD|lorem ipsum)\b/i.test(c.paragraphs.join(' ')));for(const p of c.paragraphs){const ph=hash(p);assert(!proseHashes.has(ph),'Duplicate paragraph '+id);proseHashes.add(ph);}}
}
assert.equal(artHashes.size,15);
for(const s of m.editions){const n=idx.get(s.id);assert.equal(n.albumId,s.albumId);assert.equal(n.attributes.releaseDate.value,s.releaseDate);assert.equal(n.attributes.catalogNumber.value,s.catalogNumber);
 const tracks=d.nodes.filter(n=>n.editionId===s.id).sort((a,b)=>a.position-b.position);trackCount+=tracks.length;
 assert.deepEqual(tracks.map(n=>({position:n.position,slotLabel:n.slotLabel,title:n.attributes.trackTitle.value})),s.tracks.map(t=>({position:t.position,slotLabel:t.slotLabel||String(t.position),title:t.title})));
 for(const x of [n,...tracks]){const article=articles.get(x.id);assert.equal(article.canonicalEntityId,s.albumId);assert(article.illustration.shared);assert.equal(article.illustration.src,articles.get(s.albumId).illustration.src);assert.equal(article.locales.en.paragraphs.length,3);}
 for(const t of s.tracks){const n=tracks.find(n=>n.position===t.position);for(const key of ['discNumber','trackOnDisc'])if(t[key])assert.equal(n.attributes[key]?.value,t[key]);if(t.bonus)assert.equal(n.attributes.trackKind?.value,'bonus_track');if(t.version)assert.equal(n.attributes.recordingVersion?.value,t.version);}
}
assert.equal(m.newNodeIds.length,20+trackCount);assert.equal(d.nodes.filter(n=>n.type==='track').length,767+trackCount);
for(const id of artists){assert.equal(idx.get(id).type,'artist');assert(d.edges.some(e=>e.source===id&&e.type==='released'&&albums.includes(e.target)));}
for(const id of songs){assert.equal(idx.get(id).type,'song');assert(d.nodes.some(n=>n.type==='track'&&n.compositionEntryId===id));assert(d.edges.some(e=>e.target===id&&e.type==='performer'&&artists.includes(e.source)));}
for(const id of m.newEdgeIds){const e=d.edges.find(e=>e.id===id);assert(e&&idx.has(e.source)&&idx.has(e.target));assert(e.sources.length);assert.equal(e.checkedAt,'2026-10-05');}
assert.equal(idx.get('person_yoshitaka_minami').portraitEmbed?.status,'verified');
for(const id of ['person_masamichi_sugi','person_hiroshi_sato'])assert(!idx.get(id).portraitEmbed,'Cover artwork is not a standalone identified portrait');
console.log(`PASS batch5: five absent artists, five albums, five songs, five exact editions, ${trackCount} positions; 15 original illustrated trilingual essays and sourced relationships`);
