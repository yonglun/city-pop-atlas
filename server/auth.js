// Sites requests must enter through trusted Sites dispatch. Linux requests
// must enter through the separate production listener, which sets its own flag.
// Never expose this Worker as a raw origin with caller-supplied identity headers.
// Account IDs, email addresses, client role flags and service tokens are not roles.
function adminIds(env) {
 try {
  const ids=JSON.parse(env.SITE_REVIEW_ADMIN_USER_IDS||'null');
  return Array.isArray(ids)&&ids.length>0&&ids.every(id=>typeof id==='string'&&id.length>0&&id.length<=512&&!/[\s,]/.test(id))?ids:[];
 } catch {return []}
}
function identity(request) {
 const id=request.headers.get('oai-authenticated-user-id');
 return id&&id.length<=512&&!/[\s,]/.test(id)?id:null;
}
export function reviewSession(request,env) {
 // An explicitly supplied Linux flag is authoritative, including false or invalid
 // values: never fall back to Sites identity headers on either Linux listener.
 if(Object.hasOwn(env,'LINUX_AUTHENTICATED_ADMIN')) {
  const allowed=env.LINUX_AUTHENTICATED_ADMIN===true;
  return {canReview:allowed,state:allowed?'admin':'forbidden',provider:'linux'};
 }
 const id=identity(request),ids=adminIds(env),enabled=env.SITE_REVIEW_MODE==='owner-private';
 const canReview=enabled&&!!id&&ids.includes(id);
 return {canReview,state:!id?'signed-out':canReview?'admin':enabled&&!ids.length?'setup-required':'forbidden',
  // Only show a visitor their own non-secret ID while admin binding is pending.
  ...(id&&enabled&&!ids.length?{accountId:id}:{})};
}
export function canReview(request,env) {return reviewSession(request,env).canReview}
export function reviewGuard(request,env) {
 return canReview(request,env)?null:{error:'review_not_authorized',status:403};
}
export function mutationGuard(request,env) {
 const blocked=reviewGuard(request,env);if(blocked)return blocked;
 if(request.method!=='POST')return {error:'method_not_allowed',status:405};
 if(!env.SITE_REVIEW_ORIGIN||request.headers.get('Origin')!==env.SITE_REVIEW_ORIGIN)return {error:'origin_not_allowed',status:403};
 const site=request.headers.get('Sec-Fetch-Site');if(site&&site!=='same-origin')return {error:'origin_not_allowed',status:403};
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return {error:'json_required',status:415};
 return null;
}
