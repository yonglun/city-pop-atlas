import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const d=JSON.parse(fs.readFileSync('data/catalog.json'));
const a=JSON.parse(fs.readFileSync('public/articles.json'));
const m=JSON.parse(fs.readFileSync('docs/COLLECTION-2026-10-05-ARTISTS-BATCH3.json'));
const idx=new Map(d.nodes.map(n=>[n.id,n])),articles=new Map(a.map(x=>[x.entityId,x]));
const artists=['person_yumi_matsutoya','person_akiko_yano','person_kiyotaka_sugiyama','person_toshinobu_kubota','person_yuko_imai'];
const albums=['album_cobalt_hour','album_gohan_ga_dekitayo','album_beyond','album_shake_it_paradise','album_do_away'];
const songs=['song_cobalt_hour','song_tong_poo_akiko_yano','song_long_time_ago','song_missing','song_ai_wa_kanata_imai','song_gekkou_iwasaki'];
const expectedCore=[...artists,...albums,...songs];
assert.deepEqual(new Set(m.newCoreIds),new Set(expectedCore));assert.equal(m.newCoreIds.length,16);assert.equal(m.editions.length,5);
assert.deepEqual(m.baseCounts,{nodes:986,edges:1395,articles:986});
assert(d.nodes.length>=986+m.newNodeIds.length);assert(d.edges.length>=1395+m.newEdgeIds.length);
assert.equal(a.length,d.nodes.length);assert(a.filter(x=>x.kind!=='contextual').length>=178);
assert(d.nodes.filter(n=>['artist','person'].includes(n.type)).length>=58);
assert(d.nodes.filter(n=>n.type==='album').length>=57);assert(d.nodes.filter(n=>n.type==='song').length>=63);assert(d.nodes.filter(n=>n.type==='edition').length>=66);
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
assert.equal(artHashes.size,16);
for(const s of m.editions){
 const n=idx.get(s.id);assert.equal(n.albumId,s.albumId);assert.equal(n.attributes.releaseDate.value,s.releaseDate);assert.equal(n.attributes.catalogNumber.value,s.catalogNumber);
 const tracks=d.nodes.filter(n=>n.editionId===s.id).sort((a,b)=>a.position-b.position);trackCount+=tracks.length;
 assert.deepEqual(tracks.map(n=>({position:n.position,slotLabel:n.slotLabel,title:n.attributes.trackTitle.value})),s.tracks.map(t=>({position:t.position,slotLabel:t.slotLabel||String(t.position),title:t.title})));
 for(const x of [n,...tracks]){const article=articles.get(x.id);assert.equal(article.canonicalEntityId,s.albumId);assert(article.illustration.shared);assert.equal(article.illustration.src,articles.get(s.albumId).illustration.src);assert.equal(article.locales.en.paragraphs.length,3);}
}
assert.equal(trackCount,m.editions.reduce((x,e)=>x+e.tracks.length,0));assert.equal(m.newNodeIds.length,21+trackCount);assert(d.nodes.filter(n=>n.type==='track').length>=656+trackCount);
for(const id of artists){assert.equal(idx.get(id).type,'artist');assert(d.edges.some(e=>e.source===id&&e.type==='released'&&albums.includes(e.target)));}
for(const id of songs){assert.equal(idx.get(id).type,'song');if(id!=='song_gekkou_iwasaki')assert(d.nodes.some(n=>n.type==='track'&&n.compositionEntryId===id));assert(d.edges.some(e=>e.target===id&&e.type==='performer'));}
const edge=(source,target,type)=>d.edges.find(e=>e.source===source&&e.target===target&&e.type===type);
assert(edge('person_toshinobu_kubota','song_gekkou_iwasaki','composer'));assert(edge('person_hiromi_iwasaki','song_gekkou_iwasaki','performer'));
assert(edge('person_ryuichi_sakamoto','song_tong_poo_akiko_yano','composer'));assert(edge('person_akiko_yano','song_tong_poo_akiko_yano','lyricist'));
assert(edge('person_makoto_matsushita','song_long_time_ago','arranger'));assert(edge('person_minako_yoshida','song_ai_wa_kanata_imai','composer'));
for(const id of ['person_tatsuro_yamashita','person_taeko_onuki','person_minako_yoshida','person_haruomi_hosono']){assert(edge(id,'album_cobalt_hour','performer'));assert(!edge(id,'song_cobalt_hour','performer'),'Album-level participation cannot be promoted to track-level credit');}
assert(idx.get('person_yumi_matsutoya').aliases.includes('荒井由実'));assert(!idx.has('person_yumi_arai'),'Artist aliases are one identity');
assert.equal(idx.get('person_yuko_imai').portraitEmbed?.status,'verified');
console.log(`PASS batch3: five new artists, five albums, six songs, five precise issues and ${trackCount} slots; sixteen illustrated three-language essays and source-scoped collaborations`);
