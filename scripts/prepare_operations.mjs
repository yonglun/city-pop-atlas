#!/usr/bin/env node
// Offline manifest conversion: no network, no database writes and no approvals.
import fs from 'node:fs';import path from 'node:path';
import {normalizeOperation,applyOperation,hash,canonical,suggestions} from '../server/operations.js';
export async function prepareManifest(manifest,catalog){
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))throw Error('Manifest must be an object');
 const allowed=['entities','relationships','recordingMatches','merges'];if(Object.keys(manifest).some(k=>!allowed.includes(k)))throw Error('Unknown manifest section');
 const rows=[];for(const [section,kind,field]of [['entities','entity','node'],['relationships','relationship','relationship'],['recordingMatches','recording_match',null],['merges','merge',null]]){
  const list=manifest[section]||[];if(!Array.isArray(list))throw Error(section+' must be an array');for(const row of list){if(!row||typeof row!=='object'||!row.evidence)throw Error(section+' item needs evidence');const raw=field?{kind,...row.evidence,[field]:row[field]}:{...row,...row.evidence,kind};delete raw.evidence;const normalized=normalizeOperation(raw,catalog);rows.push({raw,normalized})}
 }
 if(!rows.length||rows.length>500)throw Error('Manifest needs 1–500 operations');
 const operations=[],seen=new Set(),report=[];for(const {raw,normalized}of rows){const key=canonical(normalized);if(seen.has(key))continue;seen.add(key);let blocked=null;try{applyOperation(catalog,normalized)}catch(e){blocked=e.message}operations.push(raw);report.push({kind:normalized.kind,blocked,suggestions:normalized.kind==='entity'?suggestions(normalized.node,catalog):[]})}
 const batches=[];let current=[];for(const op of operations){const proposed=[...current,op];if(proposed.length>50||new TextEncoder().encode(JSON.stringify({operations:proposed})).length>60000){if(!current.length)throw Error('One operation exceeds 60 KiB');batches.push(current);current=[]}current.push(op);if(new TextEncoder().encode(JSON.stringify({operations:current})).length>60000)throw Error('One operation exceeds 60 KiB')}if(current.length)batches.push(current);
 return {batches,report,manifestHash:await hash(manifest)};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+path.resolve(process.argv[1])).href){
 try{const [manifestPath,catalogPath,outputDir]=process.argv.slice(2);if(!manifestPath||!catalogPath||!outputDir)throw Error('Usage: node scripts/prepare_operations.mjs MANIFEST.json CATALOG.json NEW_OUTPUT_DIRECTORY');const m=JSON.parse(fs.readFileSync(manifestPath,'utf8')),c=JSON.parse(fs.readFileSync(catalogPath,'utf8'));const result=await prepareManifest(m,c);fs.mkdirSync(outputDir);for(const [i,operations]of result.batches.entries())fs.writeFileSync(path.join(outputDir,`operations-${String(i+1).padStart(3,'0')}.json`),JSON.stringify({operations},null,2)+'\n',{flag:'wx'});fs.writeFileSync(path.join(outputDir,'report.json'),JSON.stringify({manifestHash:result.manifestHash,items:result.report,note:'Offline preparation only. Missing dependencies can be approved first in the Site. No decisions made.'},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({batches:result.batches.length,operations:result.report.length,output:outputDir}))}catch(e){console.error(e.message);process.exitCode=1}
}
