import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
export function openDatabase(filename=':memory:') {
 const sqlite=new DatabaseSync(filename);sqlite.exec('PRAGMA foreign_keys=ON');
 sqlite.exec('CREATE TABLE IF NOT EXISTS _local_migrations(name TEXT PRIMARY KEY)');
 for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) {
  if(sqlite.prepare('SELECT name FROM _local_migrations WHERE name=?').get(file)) continue;
  sqlite.exec('BEGIN');try{sqlite.exec(fs.readFileSync('drizzle/'+file,'utf8'));sqlite.prepare('INSERT INTO _local_migrations VALUES(?)').run(file);sqlite.exec('COMMIT')}catch(e){sqlite.exec('ROLLBACK');throw e;}
 }
 function prepare(sql){let args=[];return{bind(...values){args=values;return this},first(){return sqlite.prepare(sql).get(...args)||null},run(){return sqlite.prepare(sql).run(...args)},all(){return{results:sqlite.prepare(sql).all(...args)}},sql,get args(){return args}}}
 return {sqlite,prepare,async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>/^\s*SELECT/i.test(s.sql)?s.all():s.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}};
}
