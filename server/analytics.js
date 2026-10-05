// Deliberately return only these public integration identifiers. Never serialize env.
export function analyticsConfig(request,env,{isAdmin=false}={}) {
 const ga=typeof env.GA_MEASUREMENT_ID==='string'?env.GA_MEASUREMENT_ID.trim():'';
 const clarity=typeof env.CLARITY_PROJECT_ID==='string'?env.CLARITY_PROJECT_ID.trim():'';
 const blocked=isAdmin||request.headers.get('DNT')==='1'||request.headers.get('Sec-GPC')==='1';
 return {gaMeasurementId:!blocked&&/^G-[A-Z0-9]{4,20}$/.test(ga)?ga:'',clarityProjectId:!blocked&&/^[a-z0-9]{4,32}$/.test(clarity)?clarity:'',blocked};
}
