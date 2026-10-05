#!/usr/bin/env python3
"""Isolated synthetic regression checks; never uses real Docker."""
import hashlib, io, json, os, pathlib, sqlite3, subprocess, tarfile, tempfile, unittest
HERE=pathlib.Path(__file__).resolve().parent
class Scripts(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='citypop-script-tests-'); self.base=pathlib.Path(self.temp.name)
        self.root=self.base/'install with spaces'; self.log=self.base/'docker.log'
        self.bin=self.base/'bin';self.bin.mkdir()
        stub=self.bin/'docker';stub.write_text('''#!/usr/bin/env python3
import json,os,pathlib,sqlite3,sys
with open(os.environ['DOCKER_TEST_LOG'],'a') as f:f.write(json.dumps(sys.argv[1:])+'\\n')
if 'backup' in sys.argv:
 i=sys.argv.index('backup');name=pathlib.Path(sys.argv[i+2]).name
 source=sqlite3.connect(pathlib.Path(os.environ['CITYPOP_DATA_DIR'])/'catalog.sqlite')
 target=sqlite3.connect(pathlib.Path(os.environ['CITYPOP_BACKUP_DIR'])/name)
 try:source.backup(target)
 finally:target.close();source.close()
 if os.environ.get('FAIL_BACKUP'):sys.exit(17)
''');stub.chmod(0o700)
        self.env=dict(os.environ,PATH=str(self.bin)+os.pathsep+os.environ['PATH'],DOCKER_TEST_LOG=str(self.log))
    def tearDown(self):self.temp.cleanup()
    def release(self,version='one',schema=1,evil=None):
        files={'compose.yaml':b'services: {}\n','.env.example':b'ADMIN_ENABLED=false\n','release.json':json.dumps({'version':version,'schemaVersion':schema}).encode(),'app.txt':version.encode()}
        files['SHA256SUMS']=''.join(hashlib.sha256(v).hexdigest()+'  '+k+'\n' for k,v in files.items()).encode()
        p=self.base/(version+'.tar.gz')
        with tarfile.open(p,'w:gz') as tf:
            for n,v in files.items():
                t=tarfile.TarInfo('package/'+n);t.size=len(v);tf.addfile(t,io.BytesIO(v))
            if evil:
                t=tarfile.TarInfo(evil)
                if 'symlink' in evil:t.type=tarfile.SYMTYPE;t.linkname='/tmp'
                tf.addfile(t)
        return p,hashlib.sha256(p.read_bytes()).hexdigest()
    def call(self,*args,ok=True):
        r=subprocess.run(['bash',str(HERE/'citypop.sh'),'--root',str(self.root),*map(str,args)],env=self.env,text=True,capture_output=True)
        if ok:self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        else:self.assertNotEqual(r.returncode,0,r.stdout+r.stderr)
        return r
    def install_db(self,version='one'):
        p,d=self.release(version);self.call('install',p,d)
        with sqlite3.connect(self.root/'shared/data/catalog.sqlite') as db:db.execute('CREATE TABLE _linux_migrations(name TEXT,sha256 TEXT)');db.execute("INSERT INTO _linux_migrations VALUES('001','test')")
        return d[:16]
    def test_help_and_dry_run(self):
        p,d=self.release();self.call('--dry-run','install',p,d);self.assertFalse(self.root.exists())
        self.assertIn('configure-admin',subprocess.check_output(['bash',str(HERE/'citypop.sh'),'--help'],text=True))
    def test_checksum_and_archive_attacks(self):
        for i,evil in enumerate(('/absolute','package/../escape','package/symlink','package/app.txt')):
            p,d=self.release('bad'+str(i),evil=evil);self.call('install',p,d,ok=False)
        p,d=self.release();self.call('install',p,'0'*64,ok=False)
    def test_idempotent_install_start_stop_and_backup(self):
        self.install_db();p=self.base/'one.tar.gz';d=hashlib.sha256(p.read_bytes()).hexdigest();self.call('install',p,d)
        env=self.root/'shared/.env';self.assertEqual(env.stat().st_mode&0o777,0o600)
        for cmd in ('start','restart','status','logs','stop','backup'):self.call(cmd)
        backups=list((self.root/'shared/backups').glob('*.sqlite'));self.assertEqual(len(backups),1)
        self.assertEqual(backups[0].stat().st_mode&0o777,0o600)
        self.call('restore',backups[0],ok=False)
        self.call('restore',backups[0],'--confirm-restore')
        self.assertTrue(list((self.root/'shared/data').glob('catalog.sqlite.before-restore-*')))
        self.assertNotIn('down',self.log.read_text());self.assertNotIn('prune',self.log.read_text())
    def test_explicit_restore_roundtrip_keeps_newer_recovery_data(self):
        release=self.install_db();database=self.root/'shared/data/catalog.sqlite'
        def rows(file=database):
            with sqlite3.connect(file) as db:
                self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok')
                self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
                return db.execute('SELECT * FROM fixture_restore ORDER BY id').fetchall()
        with sqlite3.connect(database) as db:
            db.execute('CREATE TABLE fixture_restore(id INTEGER PRIMARY KEY, value TEXT)')
            db.execute("INSERT INTO fixture_restore VALUES(1,'snapshot A')")
        original=rows();self.call('backup')
        selected=next((self.root/'shared/backups').glob('*.sqlite'))
        selected_digest=hashlib.sha256(selected.read_bytes()).hexdigest()
        self.assertEqual(rows(selected),original)
        with sqlite3.connect(database) as db:
            db.execute("UPDATE fixture_restore SET value='newer snapshot B' WHERE id=1")
            db.execute("INSERT INTO fixture_restore VALUES(2,'new write after backup')")
        newer=rows();self.assertNotEqual(newer,original)
        # This is intentionally destructive only for a disposable fixture. Without
        # explicit confirmation, the newer active state must remain untouched.
        self.call('restore',selected,ok=False);self.assertEqual(rows(),newer)
        self.call('restore',selected,'--confirm-restore')
        self.assertEqual(rows(),original,'Explicit restore must really restore the earlier SQLite state')
        self.assertEqual((self.root/'current').resolve().name,release)
        self.assertEqual(database.stat().st_mode&0o777,0o600)
        self.assertEqual(hashlib.sha256(selected.read_bytes()).hexdigest(),selected_digest)
        backups=list((self.root/'shared/backups').glob('*.sqlite'));self.assertEqual(len(backups),2)
        safety=next(file for file in backups if file!=selected)
        self.assertEqual(rows(safety),newer,'Pre-restore safety backup must retain the newer writes')
        retained=list((self.root/'shared/data').glob('catalog.sqlite.before-restore-*'))
        self.assertEqual(len(retained),1);self.assertEqual(rows(retained[0]),newer)
        calls=[json.loads(line) for line in self.log.read_text().splitlines()]
        stop=next(index for index,call in enumerate(calls) if call[-1]=='stop')
        backup=max(index for index,call in enumerate(calls) if 'backup' in call)
        up=next(index for index,call in enumerate(calls) if 'up' in call)
        self.assertLess(stop,backup);self.assertLess(backup,up)
    def test_upgrade_and_migration_aware_rollback(self):
        first=self.install_db();p,d=self.release('two',schema=2);self.call('upgrade',p,d)
        self.assertEqual((self.root/'current').resolve().name,d[:16])
        self.call('rollback',first,ok=False)
        backup=next((self.root/'shared/backups').glob('*.sqlite'))
        self.call('rollback',first,'--backup',backup,'--confirm-restore')
        self.assertEqual((self.root/'current').resolve().name,first)
    def test_same_day_upgrade_rollback_reupgrade_preserve_env_and_history(self):
        first=self.install_db('20261005-v27');database=self.root/'shared/data/catalog.sqlite'
        # Preserve the complete operator-owned file, including comments, unknown
        # options, mixed line endings, whitespace, legacy values and no final LF.
        environment=(b'# existing operator settings; preserve every byte\r\n'
            b'RELEASE_TAG=20261005-v27\nADMIN_ENABLED=false\r\n'
            b'PUBLIC_ORIGIN=https://archive.example.invalid\n'
            b'ADMIN_ORIGIN=http://127.0.0.1:9181\nADMIN_HOST_PORT=9181\n'
            b'GA_MEASUREMENT_ID=G-LEGACY1234\nCLARITY_PROJECT_ID=legacy1234\n'
            b'CUSTOM_OPTION=" keep whitespace # literally "\r\n'
            b'# UTF-8 note: '+ '保留する'.encode()+b'\nUNRECOGNIZED_FUTURE_OPTION=unchanged')
        env=self.root/'shared/.env';env.write_bytes(environment);env.chmod(0o600)
        def preserved_env():
            self.assertEqual(env.read_bytes(),environment,'Existing .env must not be rewritten')
            self.assertEqual(env.stat().st_mode&0o777,0o600)
        def user_rows():
            with sqlite3.connect(database) as db:
                return [db.execute('SELECT * FROM '+table+' ORDER BY id').fetchall()
                    for table in ('fixture_user_edits','fixture_audit')]
        with sqlite3.connect(database) as db:
            db.execute('CREATE TABLE fixture_user_edits(id INTEGER PRIMARY KEY, value TEXT)')
            db.execute('CREATE TABLE fixture_audit(id INTEGER PRIMARY KEY, action TEXT)')
            db.execute("INSERT INTO fixture_user_edits VALUES(1,'before upgrade')")
            db.execute("INSERT INTO fixture_audit VALUES(1,'approved before upgrade')")
        original=self.base/'20261005-v27.tar.gz'
        self.call('install',original,hashlib.sha256(original.read_bytes()).hexdigest());preserved_env()
        before=user_rows()
        p,d=self.release('20261005-v33',schema=1);self.assertNotEqual(first,d[:16])
        self.call('upgrade',p,d);preserved_env()
        self.assertEqual((self.root/'current').resolve().name,d[:16]);self.assertEqual(user_rows(),before)
        with sqlite3.connect(database) as db:
            db.execute("INSERT INTO fixture_user_edits VALUES(2,'after upgrade')")
            db.execute("INSERT INTO fixture_audit VALUES(2,'approved after upgrade')")
            db.execute("INSERT INTO fixture_user_edits VALUES(3,'removed after upgrade')")
            db.execute("INSERT INTO fixture_audit VALUES(3,'approved then removed after upgrade')")
            db.execute('DELETE FROM fixture_user_edits WHERE id=3')
        newer=user_rows()
        self.call('rollback',first);preserved_env()
        self.assertEqual((self.root/'current').resolve().name,first);self.assertEqual(user_rows(),newer)
        self.call('upgrade',p,d);preserved_env()
        self.assertEqual((self.root/'current').resolve().name,d[:16]);self.assertEqual(user_rows(),newer)
        # Repeating the upgrade is a no-op; no new backup and no config reset.
        self.call('upgrade',p,d);preserved_env();self.assertEqual(user_rows(),newer)
        self.assertFalse(list((self.root/'shared/data').glob('*.before-restore-*')))
        backups=list((self.root/'shared/backups').glob('*.sqlite'));self.assertEqual(len(backups),3)
        counts=[]
        for backup in backups:
            with sqlite3.connect(backup) as db:
                counts.append(db.execute('SELECT count(*) FROM fixture_user_edits').fetchone()[0])
                self.assertEqual(db.execute('SELECT count(*) FROM fixture_user_edits WHERE id=3').fetchone()[0],0)
        self.assertEqual(sorted(counts),[1,2,2])
    def test_stops_before_backup_and_keeps_old_release_on_failure(self):
        first=self.install_db();p,d=self.release('failure',schema=2)
        self.env['FAIL_BACKUP']='1'
        result=self.call('upgrade',p,d,ok=False)
        self.assertIn('services remain stopped',result.stderr)
        self.assertEqual((self.root/'current').resolve().name,first)
        calls=[json.loads(x) for x in self.log.read_text().splitlines()]
        stop=next(i for i,x in enumerate(calls) if x[-1]=='stop')
        backup=next(i for i,x in enumerate(calls) if 'backup' in x)
        self.assertLess(stop,backup)
        self.assertFalse(any('up' in x for x in calls))
    def test_metadata_failure_keeps_old_release_stopped(self):
        first=self.install_db();p,d=self.release('metadata-failure',schema=2)
        (self.root/'releases'/first/'release.json').write_text('broken metadata')
        result=self.call('upgrade',p,d,ok=False)
        self.assertIn('services remain stopped',result.stderr)
        self.assertEqual((self.root/'current').resolve().name,first)
        self.assertFalse(any('up' in json.loads(x) for x in self.log.read_text().splitlines()))
    def test_tampered_backup_and_unsafe_root(self):
        self.install_db();self.call('backup');backup=next((self.root/'shared/backups').glob('*.sqlite'));backup.write_bytes(b'corrupted')
        self.call('restore',backup,'--confirm-restore',ok=False)
        self.root.chmod(0o755);self.call('status',ok=False)
if __name__=='__main__':unittest.main(verbosity=2)
