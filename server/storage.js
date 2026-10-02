import {applyOperations} from './operations.js';
// Prepared statements only; schema changes are owned by Drizzle migrations.
export async function seedCatalog(db, seed) {
  await db.prepare("INSERT OR IGNORE INTO catalog_state(id,epoch) VALUES('graph',0)").run();
  const current = await db.prepare('SELECT id FROM imports ORDER BY rowid DESC LIMIT 1').first();
  if (current?.id === seed.revision) return;
  const statements = [];
  const add = (sql, ...args) => statements.push(db.prepare(sql).bind(...args));
  // Only reviewed catalog rows live here; no visitor-created or private data.
  // Replace the snapshot in one transaction, including removals and the revision marker.
  for (const table of ['external_links','media','relationships','entities','property_definitions']) add('DELETE FROM '+table);
  const entities=[],media=[],links=[];
  for(const n of seed.nodes) {
    const {media:images=[],serviceLinks=[],...entity}=n;
    entities.push({id:n.id,type:n.type,year:n.year||null,payload:JSON.stringify(entity)});
    images.forEach((m,i)=>media.push({id:`${n.id}:media:${i}`,entity:n.id,kind:m.kind||'image',payload:JSON.stringify(m)}));
    serviceLinks.forEach((l,i)=>links.push({id:`${n.id}:link:${i}`,entity:n.id,service:l.service,payload:JSON.stringify(l)}));
  }
  // JSON table inserts keep this import below Free-plan query/bind limits.
  // All JSON parameters must remain below D1's 2 MB string limit.
  const encode=rows=>{const text=JSON.stringify(rows);if(new TextEncoder().encode(text).length>1_800_000)throw Error('Snapshot requires staged import');return text};
  add("INSERT INTO entities(id,type,year,payload,updated_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.type'),json_extract(value,'$.year'),json_extract(value,'$.payload'),? FROM json_each(?)",seed.updatedAt,encode(entities));
  add("INSERT INTO media(id,entity_id,kind,payload) SELECT json_extract(value,'$.id'),json_extract(value,'$.entity'),json_extract(value,'$.kind'),json_extract(value,'$.payload') FROM json_each(?)",encode(media));
  add("INSERT INTO external_links(id,entity_id,service,payload) SELECT json_extract(value,'$.id'),json_extract(value,'$.entity'),json_extract(value,'$.service'),json_extract(value,'$.payload') FROM json_each(?)",encode(links));
  add("INSERT INTO relationships(id,source,target,type,payload) SELECT json_extract(value,'$.id'),json_extract(value,'$.source'),json_extract(value,'$.target'),json_extract(value,'$.type'),json(value) FROM json_each(?)",encode(seed.edges));
  add("INSERT INTO property_definitions(key,payload) SELECT json_extract(value,'$.key'),json(value) FROM json_each(?)",encode(seed.properties));
  add('INSERT OR REPLACE INTO imports(id,imported_at,entity_count,relationship_count) VALUES(?,?,?,?)',seed.revision,seed.updatedAt,seed.nodes.length,seed.edges.length);
  add("UPDATE catalog_state SET epoch=epoch+1 WHERE id='graph'");
  await db.batch(statements);
}
export async function readCatalog(db, seed) {
  await seedCatalog(db,seed);
  const [entities,relations,media,links,properties,meta,overrides,operations,state]=await db.batch([
    db.prepare('SELECT payload FROM entities ORDER BY rowid'),
    db.prepare('SELECT payload FROM relationships ORDER BY rowid'),
    db.prepare('SELECT entity_id,payload FROM media ORDER BY id'),
    db.prepare('SELECT entity_id,payload FROM external_links ORDER BY id'),
    db.prepare('SELECT payload FROM property_definitions ORDER BY key'),
    db.prepare('SELECT id,imported_at FROM imports ORDER BY rowid DESC LIMIT 1'),
    db.prepare('SELECT entity_id,field,payload,updated_at FROM attribute_overrides'),
    db.prepare("SELECT id,payload FROM catalog_operations WHERE status='approved' ORDER BY applied_order"),
    db.prepare("SELECT epoch FROM catalog_state WHERE id='graph'")
  ]);
  const nodes=entities.results.map(r=>({...JSON.parse(r.payload),media:[],serviceLinks:[]}));
  const byId=new Map(nodes.map(n=>[n.id,n]));
  for(const r of media.results) byId.get(r.entity_id)?.media.push(JSON.parse(r.payload));
  for(const r of links.results) byId.get(r.entity_id)?.serviceLinks.push(JSON.parse(r.payload));
  for(const r of overrides.results){const n=byId.get(r.entity_id);if(n){const value=JSON.parse(r.payload);n.attributes={...n.attributes,[r.field]:value};if(r.field==='releaseDate'&&['album','edition'].includes(n.type))n.year=Number(String(value.value).slice(0,4));n.sources=[...new Set([...(n.sources||[]),value.sourceUrl])];n.updatedAt=r.updated_at.slice(0,10)}}
  return applyOperations({schemaVersion:3,epoch:state.results[0].epoch,entityAliases:seed.entityAliases||{},revision:meta.results[0].id,updatedAt:meta.results[0].imported_at,storage:'D1',nodes,edges:relations.results.map(r=>JSON.parse(r.payload)),properties:properties.results.map(r=>JSON.parse(r.payload))},operations.results,overrides.results);
}
