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
import json,os,pathlib,shutil,sys
with open(os.environ['DOCKER_TEST_LOG'],'a') as f:f.write(json.dumps(sys.argv[1:])+'\\n')
if 'backup' in sys.argv:
 i=sys.argv.index('backup');name=pathlib.Path(sys.argv[i+2]).name
 shutil.copyfile(pathlib.Path(os.environ['CITYPOP_DATA_DIR'])/'catalog.sqlite',pathlib.Path(os.environ['CITYPOP_BACKUP_DIR'])/name)
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
    def install_db(self):
        p,d=self.release();self.call('install',p,d)
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
    def test_upgrade_and_migration_aware_rollback(self):
        first=self.install_db();p,d=self.release('two',schema=2);self.call('upgrade',p,d)
        self.assertEqual((self.root/'current').resolve().name,d[:16])
        self.call('rollback',first,ok=False)
        backup=next((self.root/'shared/backups').glob('*.sqlite'))
        self.call('rollback',first,'--backup',backup,'--confirm-restore')
        self.assertEqual((self.root/'current').resolve().name,first)
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
