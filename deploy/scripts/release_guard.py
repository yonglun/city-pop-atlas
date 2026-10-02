#!/usr/bin/env python3
"""Validate a trusted-digest release; optionally extract to an empty private directory."""
import hashlib, pathlib, re, sys, tarfile

def fail(message):
    raise SystemExit('Release rejected: ' + message)

def inspect(archive, expected, destination=None):
    if not re.fullmatch(r'[0-9a-fA-F]{64}', expected):
        fail('expected SHA-256 must contain exactly 64 hex digits')
    h = hashlib.sha256()
    with open(archive, 'rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            h.update(chunk)
    if h.hexdigest() != expected.lower():
        fail('archive SHA-256 mismatch')
    with tarfile.open(archive, 'r:gz') as tf:
        members = tf.getmembers()
        if any(m.size < 0 for m in members):
            fail('negative file size')
        if len(members) > 50000 or sum(m.size for m in members) > 1024**3:
            fail('release exceeds limits (50000 entries / 1 GiB expanded)')
        roots, files, seen = set(), {}, set()
        for member in members:
            name = member.name.rstrip('/')
            pieces = name.split('/')
            if not name or name.startswith('/') or any(p in ('', '.', '..') for p in pieces) or '\\' in name or any(ord(c) < 32 for c in name):
                fail('unsafe archive path')
            if name in seen:
                fail('duplicate archive path')
            seen.add(name)
            if not (member.isdir() or member.isfile()):
                fail('links and special files are not permitted')
            roots.add(pieces[0])
            if member.isfile():
                if len(pieces) < 2:
                    fail('files must be inside one package directory')
                files['/'.join(pieces[1:])] = member
        if len(roots) != 1:
            fail('archive requires exactly one top-level directory')
        required = {'SHA256SUMS', 'compose.yaml', '.env.example', 'release.json'}
        if not required.issubset(files):
            fail('missing release metadata or compose configuration')
        manifest = tf.extractfile(files['SHA256SUMS']).read().decode('utf-8')
        listed = {}
        for line in manifest.splitlines():
            match = re.fullmatch(r'([0-9a-f]{64})  (.+)', line)
            if not match or match[2] in listed or match[2] not in files or match[2] == 'SHA256SUMS':
                fail('invalid checksum manifest')
            listed[match[2]] = match[1]
        if set(listed) != set(files) - {'SHA256SUMS'}:
            fail('manifest must cover every release file')
        for name, digest in listed.items():
            if hashlib.sha256(tf.extractfile(files[name]).read()).hexdigest() != digest:
                fail('file checksum mismatch: ' + name)
        if destination:
            target = pathlib.Path(destination)
            if not target.is_dir() or target.is_symlink() or any(target.iterdir()):
                fail('extraction target must be an empty real directory')
            for name, member in files.items():
                output = target / name
                output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with output.open('xb') as f:
                    f.write(tf.extractfile(member).read())
                output.chmod(0o700 if member.mode & 0o111 else 0o600)
    print('Verified release ' + expected.lower()[:16])

if __name__ == '__main__':
    if len(sys.argv) not in (3, 4):
        raise SystemExit('usage: release_guard.py ARCHIVE EXPECTED_SHA256 [EMPTY_DESTINATION]')
    try:
        inspect(*sys.argv[1:])
    except (OSError, ValueError, tarfile.TarError, UnicodeError) as e:
        fail(str(e))
