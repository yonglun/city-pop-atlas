import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export function openDatabase(filename, migrationDir=new URL('../drizzle/', import.meta.url)) {
 fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
 const existed=fs.existsSync(filename), sqlite=new DatabaseSync(filename);
 sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL');
 sqlite.exec('CREATE TABLE IF NOT EXISTS _linux_migrations(name TEXT PRIMARY KEY, sha256 TEXT NOT NULL)');
 const files=fs.readdirSync(migrationDir).filter(f=>f.endsWith('.sql')).sort();
 const applied=sqlite.prepare('SELECT name,sha256 FROM _linux_migrations').all();
 for(const row of applied)if(!files.includes(row.name))throw Error('Database has migrations newer than this release; restore matching backup before rollback');
 const pending=[];
 for(const name of files){const sql=fs.readFileSync(new URL(name,migrationDir),'utf8'),sha256=createHash('sha256').update(sql).digest('hex'), prior=applied.find(r=>r.name===name);if(prior&&prior.sha256!==sha256)throw Error('Migration checksum mismatch: '+name);if(!prior)pending.push({name,sql,sha256})}
 if(existed&&pending.length){const backup=filename+'.before-migration-'+Date.now()+'.sqlite';sqlite.exec("VACUUM INTO '"+backup.replaceAll("'","''")+"'");console.log('Pre-migration backup:',backup)}
 for(const {name,sql,sha256} of pending){sqlite.exec('BEGIN IMMEDIATE');try{sqlite.exec(sql);sqlite.prepare('INSERT INTO _linux_migrations VALUES(?,?)').run(name,sha256);sqlite.exec('COMMIT')}catch(e){sqlite.exec('ROLLBACK');sqlite.close();throw e}}
 function prepare(sql){let args=[];return{bind(...values){args=values;return this},first(){return sqlite.prepare(sql).get(...args)||null},run(){return sqlite.prepare(sql).run(...args)},all(){return{results:sqlite.prepare(sql).all(...args)}},sql,get args(){return args}}}
 return {sqlite,prepare,async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>/^\s*SELECT/i.test(s.sql)?s.all():s.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}},close(){sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)');sqlite.close()}};
}
