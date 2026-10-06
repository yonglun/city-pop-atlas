const encoder=new TextEncoder();
const representations=new WeakMap();
export function matchesETag(request,etag) {
 const value=request.headers.get('If-None-Match');
 return !!value && value.split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===etag);
}
async function representation(value) {
 let pending=representations.get(value);
 if(!pending){
  pending=(async()=>{const body=JSON.stringify(value),hash=await crypto.subtle.digest('SHA-256',encoder.encode(body));return {body,etag:'"sha256-'+Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('')+'"'};})();
  representations.set(value,pending);
 }
 return pending;
}
export async function publicJSON(request,value,{publicMode=false}={}) {
 const {body,etag}=await representation(value);
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':publicMode?'public, no-cache':'no-store','X-Content-Type-Options':'nosniff'};
 // Private/admin responses may never validate a representation retained from
 // an earlier public context. Do not emit validators or 304s in private mode.
 if(publicMode){headers.ETag=etag;if(matchesETag(request,etag))return new Response(null,{status:304,headers});}
 return new Response(body,{headers});
}
export function staticAsset(request,asset,{publicMode=false}={}) {
 const headers={'Content-Type':asset.type,'Cache-Control':publicMode?(asset.immutable?'public, max-age=31536000, immutable':'public, no-cache'):'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
 if(publicMode&&asset.etag){headers.ETag=asset.etag;if(matchesETag(request,asset.etag))return new Response(null,{status:304,headers});}
 const body=request.method==='HEAD'?null:asset.encoding==='base64'?Uint8Array.from(atob(asset.body),char=>char.charCodeAt(0)):asset.body;
 return new Response(body,{headers});
}
export function versionHTMLAssets(html,urls) {
 return html.replace(/\b(src|href)=(['"])(\/[^'"?#\s<>]+)(?:\?[^'"#\s<>]*)?\2/g,(match,attribute,quote,path)=>urls[path]?`${attribute}=${quote}${urls[path]}${quote}`:match);
}
