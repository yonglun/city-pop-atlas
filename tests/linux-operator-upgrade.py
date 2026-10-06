#!/usr/bin/env python3
"""Run real operator transitions on verified TARs with a disposable Docker shim.

The actual shell installer, archive verifier, extracted migrations, Node SQLite
backup tool, shared files and symlink transitions run locally. Docker Compose is
replaced only at its process boundary: no daemon, image, network or real deployment
is used or claimed. Pair with linux-upgrade.mjs for real public/admin HTTP checks.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(old_archive, new_archive):
    source = Path(__file__).resolve().parents[1]
    operator = source / 'deploy/scripts/citypop.sh'
    old_digest, new_digest = map(sha256, [old_archive, new_archive])
    assert old_digest != new_digest
    node = shutil.which('node')
    assert node, 'Node.js is required'
    with tempfile.TemporaryDirectory(prefix='citypop-archive-operator-') as directory:
        temporary = Path(directory)
        root, bindir = temporary / 'install with spaces', temporary / 'bin'
        bindir.mkdir()
        calls_file = temporary / 'compose-calls.jsonl'
        shim = bindir / 'docker'
        shim.write_text('''#!/usr/bin/env python3
import json, os, pathlib, subprocess, sys
args = sys.argv[1:]
with open(os.environ['DOCKER_TEST_LOG'], 'a') as stream:
    stream.write(json.dumps(args) + '\\n')
if args == ['info'] or args == ['compose', 'version']:
    raise SystemExit(0)
assert args[:3] == ['compose', '--project-name', 'citypop'], args
assert args[3] == '--env-file' and args[5] == '-f', args
release = pathlib.Path(args[6]).parent
command = args[7:]
assert pathlib.Path(args[4]).read_bytes().hex() == os.environ['EXPECTED_ENV_HEX'], 'Operator environment changed'
if command[:4] == ['run', '--rm', '--no-deps', 'app']:
    assert command[4:7] == ['node', 'production/database-tool.mjs', 'backup'], command
    assert command[7] == '/app/runtime/catalog.sqlite', command
    destination = pathlib.PurePosixPath(command[8])
    assert destination.parent == pathlib.PurePosixPath('/backups'), command
    subprocess.run([os.environ['NODE_EXECUTABLE'], str(release / 'production/database-tool.mjs'),
        'backup', str(pathlib.Path(os.environ['CITYPOP_DATA_DIR']) / 'catalog.sqlite'),
        str(pathlib.Path(os.environ['CITYPOP_BACKUP_DIR']) / destination.name)], check=True)
elif command[0] == 'up':
    # Exercise extracted migration bytes, without claiming Docker services run.
    script = "const {openDatabase}=await import(process.argv[1]);const db=openDatabase(process.argv[2]);db.close();"
    subprocess.run([os.environ['NODE_EXECUTABLE'], '--input-type=module', '-e', script,
        (release / 'production/sqlite.mjs').as_uri(),
        str(pathlib.Path(os.environ['CITYPOP_DATA_DIR']) / 'catalog.sqlite')], check=True)
else:
    assert command in [['config', '--quiet'], ['stop'], ['ps'], ['logs', '--tail=100', 'app', 'web']], command
''')
        shim.chmod(0o700)
        environment = {'PATH': str(bindir) + os.pathsep + os.environ['PATH'],
                       'NODE_EXECUTABLE': node, 'DOCKER_TEST_LOG': str(calls_file),
                       'TZ': 'UTC'}
        log = []
        def call(*args):
            result = subprocess.run(['bash', str(operator), '--root', str(root), *map(str, args)],
                                    env=environment, capture_output=True, text=True, timeout=60)
            log.append({'command': list(map(str, args)), 'status': result.returncode,
                        'stdout': result.stdout, 'stderr': result.stderr})
            assert result.returncode == 0, result.stdout + result.stderr
            return result
        call('install', old_archive, old_digest)
        old_release = root / 'releases' / old_digest[:16]
        original = (b'# existing operator settings, byte-for-byte preservation\r\n'
                    b'RELEASE_TAG=legacy-pinned-tag\nADMIN_ENABLED=false\r\n'
                    b'PUBLIC_ORIGIN=https://archive.example.org\n'
                    b'ADMIN_ORIGIN=http://127.0.0.1:9181\nADMIN_HOST_PORT=9181\n'
                    b'GA_MEASUREMENT_ID=G-FIXTURE1234\nCLARITY_PROJECT_ID=fixture1234\n'
                    b'CUSTOM_OPTION=" preserve whitespace # literally "\r\n'
                    b'# UTF-8: ' + '保留する'.encode() + b'\nUNRECOGNIZED_FUTURE_OPTION=unchanged')
        envfile = root / 'shared/.env'
        envfile.write_bytes(original)
        envfile.chmod(0o600)
        environment['EXPECTED_ENV_HEX'] = original.hex()
        secret = root / 'shared/secrets/admin-password'
        original_secret = os.urandom(32).hex().encode()
        secret.write_bytes(original_secret)
        secret.chmod(0o600)
        checks = 0
        def assert_shared():
            nonlocal checks
            assert envfile.read_bytes() == original, 'Original .env bytes were changed'
            assert envfile.stat().st_mode & 0o777 == 0o600
            assert secret.read_bytes() == original_secret, 'Existing secret was changed'
            assert secret.stat().st_mode & 0o777 == 0o600
            checks += 1
        call('start')
        database = root / 'shared/data/catalog.sqlite'
        with sqlite3.connect(database) as db:
            db.executescript('CREATE TABLE fixture_user_edits(id INTEGER PRIMARY KEY, value TEXT);'
                             'CREATE TABLE fixture_audit(id INTEGER PRIMARY KEY, action TEXT);'
                             "INSERT INTO fixture_user_edits VALUES(1,'before upgrade');"
                             "INSERT INTO fixture_audit VALUES(1,'approved before upgrade');")
        def snapshot(file=database):
            with sqlite3.connect(file) as db:
                assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
                assert not db.execute('PRAGMA foreign_key_check').fetchall()
                return {name: db.execute('SELECT * FROM ' + name + ' ORDER BY id').fetchall()
                        for name in ['fixture_user_edits', 'fixture_audit']}
        before = snapshot()
        call('install', old_archive, old_digest)
        assert_shared()
        call('upgrade', new_archive, new_digest)
        assert_shared()
        assert (root / 'current').resolve().name == new_digest[:16]
        assert snapshot() == before
        new_release = (root / 'current').resolve()
        for name in ['citypop.sh', 'release_guard.py']:
            assert (new_release / 'deploy/scripts' / name).read_bytes() == (source / 'deploy/scripts' / name).read_bytes()
        old_meta = json.loads((old_release / 'release.json').read_text())
        new_meta = json.loads((new_release / 'release.json').read_text())
        assert old_meta['schemaVersion'] == new_meta['schemaVersion']
        old_migrations = {f.name: f.read_bytes() for f in (old_release / 'drizzle').glob('*.sql')}
        new_migrations = {f.name: f.read_bytes() for f in (new_release / 'drizzle').glob('*.sql')}
        assert old_migrations == new_migrations
        with sqlite3.connect(database) as db:
            db.executescript("INSERT INTO fixture_user_edits VALUES(2,'fresh post-upgrade edit');"
                             "INSERT INTO fixture_audit VALUES(2,'approved after upgrade');"
                             "INSERT INTO fixture_user_edits VALUES(3,'removed after upgrade');"
                             "INSERT INTO fixture_audit VALUES(3,'approved then removed after upgrade');"
                             'DELETE FROM fixture_user_edits WHERE id=3;')
        newer = snapshot()
        call('rollback', old_digest[:16])
        assert_shared()
        assert (root / 'current').resolve().name == old_digest[:16]
        assert snapshot() == newer
        call('upgrade', new_archive, new_digest)
        assert_shared()
        assert (root / 'current').resolve().name == new_digest[:16]
        assert snapshot() == newer
        call('upgrade', new_archive, new_digest)
        assert_shared()
        assert snapshot() == newer
        assert not list((root / 'shared/data').glob('*.before-restore-*')), 'Code-only rollback restored old data'
        backups = list((root / 'shared/backups').glob('*.sqlite'))
        assert len(backups) == 3
        counts = []
        for backup in backups:
            state = snapshot(backup)
            counts.append(len(state['fixture_user_edits']))
            assert all(row[0] != 3 for row in state['fixture_user_edits'])
            assert state in [before, newer]
            metadata = json.loads(backup.with_suffix('.sqlite.json').read_text())
            assert metadata['sha256'] == sha256(backup)
            assert metadata['schemaVersion'] == old_meta['schemaVersion']
            assert backup.stat().st_mode & 0o777 == 0o600
        assert sorted(counts) == [1, 2, 2]
        calls = [json.loads(line) for line in calls_file.read_text().splitlines()]
        stops = [i for i, args in enumerate(calls) if args[-1] == 'stop']
        copies = [i for i, args in enumerate(calls) if 'backup' in args]
        ups = [i for i, args in enumerate(calls) if 'up' in args]
        assert len(stops) == len(copies) == 3 and len(ups) == 4
        assert all(stop < copy < up for stop, copy, up in zip(stops, copies, ups[1:]))
        assert not any('down' in args or 'prune' in args for args in calls)
        return {'passed': True, 'suite': 'linux-archive-operator-upgrade',
                'oldVersion': old_meta['version'], 'newVersion': new_meta['version'],
                'oldArchiveSHA256': old_digest, 'newArchiveSHA256': new_digest,
                'operatorEnvironmentSHA256': hashlib.sha256(original).hexdigest(),
                'byteExactEnvironmentAndSecretChecks': checks, 'verifiedBackups': len(backups),
                'retainedFreshEditRows': len(newer['fixture_user_edits']),
                'retainedAuditRows': len(newer['fixture_audit']), 'composeBoundaryCalls': len(calls),
                'scope': 'Actual archive verification/extraction, installer/operator shell, migrations, Node SQLite backups and shared-state transitions. Docker transport stubbed; no real containers or server deployment.',
                'operatorLog': log}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('old_archive', type=Path)
    parser.add_argument('new_archive', type=Path)
    args = parser.parse_args()
    print(json.dumps(run(args.old_archive.resolve(), args.new_archive.resolve()), ensure_ascii=False))
