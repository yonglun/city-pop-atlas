// Only enabled behind the verified owner-private Sites dispatch boundary.
// Disable this mode before sharing the Site; it is not a public-editor auth system.
export function canReview(request,env) {
 return env.SITE_REVIEW_MODE==='owner-private' && !!request.headers.get('oai-authenticated-user-id');
}
export function mutationGuard(request,env) {
 if(!canReview(request,env)) return {error:'review_not_authorized',status:403};
 if(request.method!=='POST')return {error:'method_not_allowed',status:405};
 if(!env.SITE_REVIEW_ORIGIN||request.headers.get('Origin')!==env.SITE_REVIEW_ORIGIN)return {error:'origin_not_allowed',status:403};
 const site=request.headers.get('Sec-Fetch-Site');if(site&&site!=='same-origin')return {error:'origin_not_allowed',status:403};
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return {error:'json_required',status:415};
 return null;
}
export async function readBody(request) {
 const reader=request.body?.getReader();if(!reader)throw Error('invalid_json');
 let size=0;const chunks=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw Error('body_too_large')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}return JSON.parse(new TextDecoder().decode(bytes));
}
const safeURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}};
function validValue(value){return typeof value==='string'&&value.length<=1000||typeof value==='number'&&Number.isFinite(value)||typeof value==='boolean'||Array.isArray(value)&&value.length<=30&&value.every(x=>typeof x==='string'&&x.length<=150)}
function validDate(value){if(!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value))return false;const [y,m,d]=value.split('-').map(Number);return y>0&&(!m||m>=1&&m<=12)&&(!d||d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate())&&(!value.includes('-00'));}
export function validateCandidate(c,catalog) {
 if(!c||typeof c!=='object'||!catalog.nodes.some(n=>n.id===c.entityId))throw Error('invalid_entity');
 if(!/^[a-z][a-zA-Z0-9]{0,63}$/.test(c.field||'')||['constructor','prototype'].includes(c.field))throw Error('invalid_field');
 const def=catalog.properties.find(p=>p.key===c.field);if(!def)throw Error('unknown_property');
 if(!validValue(c.value))throw Error('invalid_value');
 if(def.valueType==='number'&&typeof c.value!=='number'||def.valueType==='list'&&!Array.isArray(c.value)||['date','string'].includes(def.valueType)&&typeof c.value!=='string')throw Error('property_type_mismatch');
 if(def.valueType==='date'&&!validDate(c.value))throw Error('invalid_date');
 if(['trackNumber','trackCount','albumNumber','birthYear','durationMs','discCount','vinylWeightGrams'].includes(c.field)&&(!Number.isInteger(c.value)||c.value<(c.field==='durationMs'?0:1)))throw Error('invalid_number');
 if(typeof c.sourceUrl!=='string'||!safeURL(c.sourceUrl)||c.sourceUrl.length>2000||(!/^\d{4}-\d{2}-\d{2}$/.test(c.checkedAt||'')||!validDate(c.checkedAt)))throw Error('evidence_required');
 return {entityId:c.entityId,field:c.field,value:c.value,sourceUrl:c.sourceUrl,checkedAt:c.checkedAt,sourceType:String(c.sourceType||'submitted').slice(0,60),note:String(c.note||'').slice(0,1000)};
}
export async function importCandidates(db,input,catalog) {
 if(!Array.isArray(input)||!input.length||input.length>50)throw Error('candidate_limit');
 const rows=[];const now=new Date().toISOString();
 for(const item of input){const c=validateCandidate(item,catalog);const fingerprint=JSON.stringify(c);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint)))).map(n=>n.toString(16).padStart(2,'0')).join('');const node=catalog.nodes.find(n=>n.id===c.entityId);rows.push({id:'candidate_'+hash,entity:c.entityId,field:c.field,payload:fingerprint,base:JSON.stringify(node.attributes?.[c.field]?.value??null),now})}
 await db.batch([db.prepare("INSERT OR IGNORE INTO candidates(id,entity_id,field,payload,base_value,status,version,created_at,updated_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.entity'),json_extract(value,'$.field'),json_extract(value,'$.payload'),json_extract(value,'$.base'),'pending',1,json_extract(value,'$.now'),json_extract(value,'$.now') FROM json_each(?)").bind(JSON.stringify(rows))]);
 return rows.map(r=>r.id);
}
const sameOverride=(a,b)=>!!a&&!!b&&['id','entity_id','field','payload','candidate_id','updated_at'].every(k=>a[k]===b[k]);
export async function listReview(db,catalog) {
 const result=await db.batch([
  db.prepare('SELECT * FROM candidates ORDER BY created_at DESC,id'),
  db.prepare('SELECT * FROM review_events ORDER BY created_at DESC,rowid DESC LIMIT 100'),
  db.prepare('SELECT * FROM approval_snapshots'),
  db.prepare('SELECT * FROM attribute_overrides'),
  db.prepare('SELECT id,payload FROM entities')
 ]);
 const [rows,events,snapshots,overrides,entities]=result.map(x=>x.results);
 const candidates=rows.map(r=>({id:r.id,...JSON.parse(r.payload),baseValue:JSON.parse(r.base_value),status:r.status,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at,currentValue:catalog.nodes.find(n=>n.id===r.entity_id)?.attributes?.[r.field]?.value??null}));
 const describe=s=>{const c=rows.find(c=>c.id===s.candidate_id),after=JSON.parse(s.after_override),before=s.before_override?JSON.parse(s.before_override):null,base=entities.find(e=>e.id===s.entity_id);const current=overrides.find(o=>o.id===after.id);return {eventId:s.event_id,entityId:s.entity_id,field:s.field,candidateId:s.candidate_id,expectedVersion:c?.version,fromValue:JSON.parse(after.payload).value,toValue:before?JSON.parse(before.payload).value:JSON.parse(s.base_payload).attributes?.[s.field]?.value??null,reverted:!!s.reverted_by,canUndo:!s.reverted_by&&c?.status==='approved'&&c?.decision_id===s.event_id&&base?.payload===s.base_payload&&sameOverride(current,after)}};
 return {candidates:candidates.map(c=>{const row=rows.find(r=>r.id===c.id),snapshot=snapshots.find(s=>s.event_id===row.decision_id);return {...c,...(snapshot?{correction:describe(snapshot)}:{})}}),events:events.map(e=>{const c=rows.find(c=>c.id===e.candidate_id),snapshot=snapshots.find(s=>s.event_id===e.id||s.reverted_by===e.id);return {...e,entityId:c?.entity_id,field:c?.field,...(snapshot?{correction:describe(snapshot)}:{})}})};
}
export async function decideCandidate(db,id,body,catalog) {
 const {decision,expectedVersion}=body;if(!['approve','reject'].includes(decision)||!Number.isInteger(expectedVersion))return {error:'invalid_decision',status:400};
 const note=String(body.note||'').trim();if(note.length>500||decision==='reject'&&!note)return {error:'rejection_reason_required',status:400};
 const row=await db.prepare('SELECT * FROM candidates WHERE id=?').bind(id).first();if(!row)return{error:'candidate_not_found',status:404};
 const next=decision==='approve'?'approved':'rejected';
 if(row.status===next)return{status:200,result:{id,status:next,version:row.version,repeated:true}};
 if(row.status!=='pending'||row.version!==expectedVersion)return{error:'review_conflict',status:409};
 if(decision==='reject') {
  const operation=crypto.randomUUID(),now=new Date().toISOString();
  await db.batch([
   db.prepare("UPDATE candidates SET status='rejected',version=version+1,decision_id=?,updated_at=? WHERE id=? AND status='pending' AND version=?").bind(operation,now,id,expectedVersion),
   db.prepare('INSERT INTO review_events(id,candidate_id,action,note,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM candidates WHERE id=? AND decision_id=?)').bind(operation,id,decision,note,now,id,operation)
  ]);
  const result=await db.prepare('SELECT status,version,decision_id FROM candidates WHERE id=?').bind(id).first();
  return result.decision_id===operation?{status:200,result:{id,status:result.status,version:result.version}}:{error:'review_conflict',status:409};
 }
 const c=validateCandidate(JSON.parse(row.payload),catalog),node=catalog.nodes.find(n=>n.id===c.entityId);
 if(decision==='approve'&&JSON.stringify(node.attributes?.[c.field]?.value??null)!==row.base_value)return{error:'source_value_changed',status:409};
 const base=await db.prepare('SELECT payload FROM entities WHERE id=?').bind(c.entityId).first();if(!base)return{error:'entity_removed',status:409};
 const key=c.entityId+':'+c.field,overlay=await db.prepare('SELECT * FROM attribute_overrides WHERE id=?').bind(key).first();
 const effective=overlay?JSON.parse(overlay.payload).value:JSON.parse(base.payload).attributes?.[c.field]?.value??null;
 if(decision==='approve'&&JSON.stringify(effective)!==row.base_value)return{error:'source_value_changed',status:409};
 const operation=crypto.randomUUID(),now=new Date().toISOString();
 const statements=[db.prepare("UPDATE candidates SET status=?,version=version+1,decision_id=?,updated_at=? WHERE id=? AND status='pending' AND version=? AND EXISTS(SELECT 1 FROM entities WHERE id=? AND payload=?) AND COALESCE((SELECT payload FROM attribute_overrides WHERE id=?),'')=? AND COALESCE((SELECT candidate_id FROM attribute_overrides WHERE id=?),'')=? AND COALESCE((SELECT updated_at FROM attribute_overrides WHERE id=?),'')=? AND COALESCE((SELECT entity_id FROM attribute_overrides WHERE id=?),'')=? AND COALESCE((SELECT field FROM attribute_overrides WHERE id=?),'')=?").bind(next,operation,now,id,expectedVersion,c.entityId,base.payload,key,overlay?.payload||'',key,overlay?.candidate_id||'',key,overlay?.updated_at||'',key,overlay?.entity_id||'',key,overlay?.field||'')];
 if(decision==='approve') {
  const payload=JSON.stringify({value:c.value,sourceUrl:c.sourceUrl,sourceType:c.sourceType,checkedAt:c.checkedAt,reviewedAt:now,reviewStatus:'approved'});
  const after={id:key,entity_id:c.entityId,field:c.field,payload,candidate_id:id,updated_at:now};
  statements.push(db.prepare('INSERT INTO approval_snapshots(event_id,candidate_id,entity_id,field,before_override,after_override,base_payload,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM candidates WHERE id=? AND decision_id=?)').bind(operation,id,c.entityId,c.field,overlay?JSON.stringify(overlay):null,JSON.stringify(after),base.payload,now,id,operation));
  statements.push(db.prepare("INSERT INTO attribute_overrides(id,entity_id,field,payload,candidate_id,updated_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM candidates WHERE id=? AND decision_id=?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,candidate_id=excluded.candidate_id,updated_at=excluded.updated_at").bind(key,c.entityId,c.field,payload,id,now,id,operation));
 }
 statements.push(db.prepare('INSERT INTO review_events(id,candidate_id,action,note,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM candidates WHERE id=? AND decision_id=?)').bind(operation,id,decision,note,now,id,operation));
 await db.batch(statements);
 const result=await db.prepare('SELECT status,version,decision_id FROM candidates WHERE id=?').bind(id).first();
 if(result.decision_id!==operation)return{error:'review_conflict',status:409};
 return{status:200,result:{id,status:result.status,version:result.version}};
}

// Reverse one immutable approval, only while its exact postimage remains current.
export async function undoApproval(db,eventId,body) {
 const expectedVersion=body?.expectedVersion,note=String(body?.note||'').trim();
 if(!Number.isInteger(expectedVersion)||expectedVersion<1)return {error:'invalid_version',status:400};
 if(!note||note.length>500)return {error:'undo_reason_required',status:400};
 const snapshot=await db.prepare('SELECT * FROM approval_snapshots WHERE event_id=?').bind(eventId).first();
 if(!snapshot)return {error:'undo_not_available',status:404};
 if(snapshot.reverted_by)return {status:200,result:{eventId,repeated:true,undoEventId:snapshot.reverted_by}};
 const conflictOrRepeated=async error=>{const latest=await db.prepare('SELECT reverted_by FROM approval_snapshots WHERE event_id=?').bind(eventId).first();return latest?.reverted_by?{status:200,result:{eventId,repeated:true,undoEventId:latest.reverted_by}}:{error,status:409}};
 const row=await db.prepare('SELECT * FROM candidates WHERE id=?').bind(snapshot.candidate_id).first();
 if(!row||row.status!=='approved'||row.decision_id!==eventId||row.version!==expectedVersion)return conflictOrRepeated('review_conflict');
 const after=JSON.parse(snapshot.after_override),before=snapshot.before_override?JSON.parse(snapshot.before_override):null;
 const current=await db.prepare('SELECT * FROM attribute_overrides WHERE id=?').bind(after.id).first();
 const base=await db.prepare('SELECT payload FROM entities WHERE id=?').bind(snapshot.entity_id).first();
 if(!base||base.payload!==snapshot.base_payload||!sameOverride(current,after))return conflictOrRepeated('source_value_changed');
 const operation=crypto.randomUUID(),now=new Date().toISOString();
 const statements=[db.prepare("UPDATE approval_snapshots SET reverted_by=? WHERE event_id=? AND reverted_by IS NULL AND EXISTS(SELECT 1 FROM candidates WHERE id=? AND status='approved' AND decision_id=? AND version=?) AND EXISTS(SELECT 1 FROM entities WHERE id=? AND payload=?) AND EXISTS(SELECT 1 FROM attribute_overrides WHERE id=? AND entity_id=? AND field=? AND payload=? AND candidate_id=? AND updated_at=?)").bind(operation,eventId,row.id,eventId,expectedVersion,snapshot.entity_id,snapshot.base_payload,after.id,after.entity_id,after.field,after.payload,after.candidate_id,after.updated_at)];
 if(before)statements.push(db.prepare('UPDATE attribute_overrides SET entity_id=?,field=?,payload=?,candidate_id=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM approval_snapshots WHERE event_id=? AND reverted_by=?)').bind(before.entity_id,before.field,before.payload,before.candidate_id,before.updated_at,before.id,eventId,operation));
 else statements.push(db.prepare('DELETE FROM attribute_overrides WHERE id=? AND EXISTS(SELECT 1 FROM approval_snapshots WHERE event_id=? AND reverted_by=?)').bind(after.id,eventId,operation));
 statements.push(db.prepare("UPDATE candidates SET status='pending',version=version+1,decision_id=NULL,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM approval_snapshots WHERE event_id=? AND reverted_by=?)").bind(now,row.id,eventId,operation));
 statements.push(db.prepare("INSERT INTO review_events(id,candidate_id,action,note,created_at) SELECT ?,?,'undo',?,? WHERE EXISTS(SELECT 1 FROM approval_snapshots WHERE event_id=? AND reverted_by=?)").bind(operation,row.id,note,now,eventId,operation));
 await db.batch(statements);
 const saved=await db.prepare('SELECT reverted_by FROM approval_snapshots WHERE event_id=?').bind(eventId).first();
 if(saved.reverted_by!==operation)return saved.reverted_by?{status:200,result:{eventId,repeated:true,undoEventId:saved.reverted_by}}:{error:'review_conflict',status:409};
 return {status:200,result:{eventId,undoEventId:operation,candidateId:row.id,status:'pending',version:expectedVersion+1}};
}
