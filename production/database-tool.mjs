import {DatabaseSync,backup} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
process.umask(0o077);
const [command,source,destination,...extra]=process.argv.slice(2);
if(extra.length||!source||!['verify','backup'].includes(command)||(command==='backup'?!destination:!!destination)){console.error('Usage: node production/database-tool.mjs verify SOURCE | backup SOURCE NEW_DESTINATION');process.exit(2)}
if(!fs.statSync(source).isFile())throw Error('Source must be a regular SQLite file');
const db=new DatabaseSync(path.resolve(source),{readOnly:true});
try{
 if(db.prepare('PRAGMA quick_check').all().some(row=>row.quick_check!=='ok'))throw Error('SQLite quick_check failed');
 if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('SQLite foreign_key_check failed');
 if(!db.prepare("SELECT name FROM sqlite_master WHERE name='_linux_migrations'").get())throw Error('Not a Linux CityPop database');
 if(command==='backup'){
  // Exclusive reservation prevents accidental overwrite; backup API copies a consistent WAL-aware snapshot.
  const fd=fs.openSync(destination,'wx',0o600);fs.closeSync(fd);
  try{await backup(db,path.resolve(destination))}catch(error){fs.unlinkSync(destination);throw error}
 }
 console.log(JSON.stringify({ok:true,command,migrations:db.prepare('SELECT name,sha256 FROM _linux_migrations ORDER BY name').all(),...(destination?{destination}:{})}));
}finally{db.close()}
