#!/usr/bin/env python3
"""Create deterministic, dependency-free Linux TAR.GZ/ZIP releases.

Run npm ci, npm run build, and the documented tests first. This script deliberately
never builds or copies from node_modules, runtime databases, or private metadata.
Its commit argument is checked against Git when run in a checkout; exported source
must be independently verified against that commit by the release operator.
"""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import tarfile
import tempfile
import zipfile

ROOT_FILES = {'.dockerignore', '.env.example', '.gitignore', 'Dockerfile', 'README.md',
              'compose.yaml', 'drizzle.config.ts', 'package.json', 'package-lock.json', 'release.json'}
SOURCE_DIRS = {'data', 'db', 'deploy', 'docs', 'drizzle', 'production', 'public', 'scripts', 'server', 'tests'}
EXCLUDED_DIRS = {'node_modules', '__pycache__', '.git', '.local', '.openai', '.cache',
                 '.sites-runtime', 'runtime', 'backups', 'releases', 'coverage', 'secrets'}
EXCLUDED_FILES = {'server/assets.generated.js', 'SHA256SUMS'}
DEFAULT_NAME = 'city-pop-linux-deploy-20261005'
MAX_PART_BYTES = 15_000_000

# Standalone, standard-library-only helper, also emitted beside release parts.
REASSEMBLY_SCRIPT = r'''#!/usr/bin/env python3
"""Verify and reassemble CityPop release parts with Python 3 only.

Obtain this script and its manifest from the trusted release channel. This verifies
integrity, not publisher identity. It never extracts an archive or starts services.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import tempfile

MAX_PART_BYTES = 15_000_000


def regular_file(path):
    if not stat.S_ISREG(path.lstat().st_mode):
        raise ValueError('Expected a regular file, not a link: ' + str(path))
    return path


def file_digest(path):
    value = hashlib.sha256()
    with regular_file(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def valid_hash(value):
    return isinstance(value, str) and re.fullmatch(r'[0-9a-f]{64}', value)


def valid_bytes(value):
    return type(value) is int and value > 0


def checked_manifest(path, selected):
    data = json.loads(regular_file(path).read_text(encoding='utf-8'))
    if data.get('schemaVersion') != 1 or data.get('partBytesLimit') != MAX_PART_BYTES:
        raise ValueError('Unsupported parts manifest')
    archives = data.get('archives')
    if not isinstance(archives, dict) or selected not in archives:
        raise ValueError('Requested archive is not in the manifest: ' + selected)
    record = archives[selected]
    name = record.get('filename', '')
    if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*\.' + re.escape(selected), name):
        raise ValueError('Unsafe archive filename')
    if not valid_bytes(record.get('bytes')) or not valid_hash(record.get('sha256')):
        raise ValueError('Invalid archive size or checksum')
    parts = record.get('parts')
    if not isinstance(parts, list) or not parts:
        raise ValueError('No parts recorded')
    total = 0
    for index, part in enumerate(parts, 1):
        if not isinstance(part, dict) or part.get('filename') != name + '.part' + str(index).zfill(3):
            raise ValueError('Unsafe, duplicated, or out-of-order part filename')
        size = part.get('bytes')
        if not valid_bytes(size) or size > MAX_PART_BYTES or not valid_hash(part.get('sha256')):
            raise ValueError('Invalid part size or checksum')
        if index < len(parts) and size != MAX_PART_BYTES:
            raise ValueError('Non-final part must have the fixed part size')
        total += size
    if total != record['bytes']:
        raise ValueError('Part sizes do not match the archive size')
    return record


def reassemble(manifest, selected, output_dir, verify_only=False):
    manifest = manifest.absolute()
    record = checked_manifest(manifest, selected)
    output_dir = output_dir.absolute() if output_dir else manifest.parent
    if not output_dir.is_dir():
        raise ValueError('Output directory must already exist')
    target = output_dir / record['filename']
    # Never follow or replace a link, or overwrite an unrelated existing file.
    existing = target.exists() or target.is_symlink()
    if existing and (regular_file(target).stat().st_size != record['bytes'] or file_digest(target) != record['sha256']):
        raise ValueError('Existing output differs; move it aside before retrying: ' + str(target))
    temporary = None
    stream = None
    try:
        if not verify_only and not existing:
            fd, name = tempfile.mkstemp(prefix='.' + record['filename'] + '.', suffix='.partial', dir=output_dir)
            temporary = Path(name)
            stream = os.fdopen(fd, 'wb')
        combined = hashlib.sha256()
        combined_bytes = 0
        for part in record['parts']:
            path = regular_file(manifest.parent / part['filename'])
            if path.stat().st_size != part['bytes']:
                raise ValueError('Part size mismatch: ' + part['filename'])
            part_hash = hashlib.sha256()
            read_bytes = 0
            with path.open('rb') as source:
                for chunk in iter(lambda: source.read(1024 * 1024), b''):
                    read_bytes += len(chunk)
                    if read_bytes > part['bytes']:
                        raise ValueError('Part grew during verification: ' + part['filename'])
                    part_hash.update(chunk)
                    combined.update(chunk)
                    if stream:
                        stream.write(chunk)
            if read_bytes != part['bytes'] or part_hash.hexdigest() != part['sha256']:
                raise ValueError('Part checksum mismatch: ' + part['filename'])
            combined_bytes += read_bytes
        if combined_bytes != record['bytes'] or combined.hexdigest() != record['sha256']:
            raise ValueError('Combined archive checksum mismatch')
        if stream:
            stream.flush()
            os.fsync(stream.fileno())
            stream.close()
            stream = None
            temporary.chmod(0o644)
            # Atomic publication without clobbering any file created concurrently.
            os.link(temporary, target)
            temporary.unlink()
            temporary = None
        print(('Verified parts: ' if verify_only else 'Verified archive: ') + str(target))
        print(record['sha256'] + '  ' + record['filename'])
    finally:
        if stream:
            stream.close()
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('archive', choices=['tar.gz', 'zip'], nargs='?', default='tar.gz')
    parser.add_argument('--output-dir', type=Path)
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    try:
        reassemble(args.manifest, args.archive, args.output_dir, args.verify_only)
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        parser.exit(1, 'Reassembly failed: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
'''


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalized_mode(path: Path) -> int:
    return 0o755 if path.stat().st_mode & 0o111 else 0o644


def excluded(name: str) -> bool:
    parts = PurePosixPath(name).parts
    return (name in EXCLUDED_FILES or parts[-1] == 'live-baseline.json' or any(p in EXCLUDED_DIRS for p in parts)
            or parts[-1].endswith(('.pyc', '.pyo', '.log', '.sqlite', '.sqlite-wal', '.sqlite-shm', '.db', '.pem', '.key'))
            or (parts[-1].startswith('.env') and name != '.env.example'))


def source_files(source: Path) -> dict[str, tuple[bytes, int]]:
    """Explicit top-level allowlist; never follow symlinks, including directories."""
    result = {}
    def collect(path: Path):
        name = path.relative_to(source).as_posix()
        if excluded(name):
            return
        if path.is_symlink():
            raise ValueError('Symlinks are not permitted in release source: ' + name)
        if path.is_dir():
            for child in sorted(path.iterdir()):
                collect(child)
        elif path.is_file():
            if any(ord(c) < 32 for c in name) or '\\' in name:
                raise ValueError('Unsafe source filename: ' + repr(name))
            result[name] = (path.read_bytes(), normalized_mode(path))
        else:
            raise ValueError('Special source file is not permitted: ' + name)
    for name in sorted(ROOT_FILES | SOURCE_DIRS):
        path = source / name
        if path.exists() or path.is_symlink():
            collect(path)
    for name in ['dist/server/index.js', 'secrets/.gitkeep']:
        path = source / name
        # A fixed runtime entrypoint avoids accidentally shipping extra build or
        # provider metadata; its bundled public assets need no npm runtime.
        components = [source.joinpath(*PurePosixPath(name).parts[:i]) for i in range(1, len(PurePosixPath(name).parts) + 1)]
        if any(component.is_symlink() for component in components) or not path.is_file():
            raise ValueError('Required release file is absent or unsafe: ' + name)
        result[name] = (path.read_bytes(), normalized_mode(path))
    required = ROOT_FILES | {'production/server.mjs', 'production/sqlite.mjs',
                            'production/database-tool.mjs', 'data/catalog.json',
                            'public/articles.json', 'data/illustration-provenance.json',
                            'public/about.json', 'data/about-photo-provenance.json',
                            'deploy/scripts/citypop.sh', 'deploy/scripts/release_guard.py'}
    missing = sorted(required - result.keys())
    if missing:
        raise ValueError('Required source files are missing: ' + ', '.join(missing))
    if not result['dist/server/index.js'][0]:
        raise ValueError('Prebuilt dist/server/index.js is empty; run npm run build first')
    if result['secrets/.gitkeep'][0]:
        raise ValueError('secrets/.gitkeep must be empty')
    return result


def content_counts(files: dict[str, tuple[bytes, int]]) -> dict[str, int]:
    catalog = json.loads(files['data/catalog.json'][0])
    articles = json.loads(files['public/articles.json'][0])
    provenance = json.loads(files['data/illustration-provenance.json'][0])
    for article in articles:
        if set(article.get('locales', {})) != {'zh', 'en', 'ja'}:
            raise ValueError('Every article must contain zh, en, and ja locales')
    illustrations = [n for n in files if n.startswith('public/illustrations/') and n.endswith(('.webp', '.png', '.jpg', '.jpeg'))]
    if len(illustrations) != len(provenance):
        raise ValueError('Illustration files and provenance counts differ')
    photos = json.loads(files['data/about-photo-provenance.json'][0])
    about = json.loads(files['public/about.json'][0])
    if set(about.get('locales', {})) != {'zh', 'en', 'ja'}:
        raise ValueError('About must contain zh, en, and ja locales')
    canonical = [a for a in articles if a.get('kind') != 'contextual']
    contextual = [a for a in articles if a.get('kind') == 'contextual']
    canonical_ids = {a['entityId'] for a in canonical}
    if len({a['entityId'] for a in articles}) != len(articles):
        raise ValueError('Duplicate article entity')
    for article in articles:
        image = article.get('illustration', {}).get('src', '')
        if not image.startswith('/illustrations/') or 'public' + image not in files:
            raise ValueError('Missing article illustration')
        if article.get('kind') == 'contextual' and article.get('canonicalEntityId') not in canonical_ids:
            raise ValueError('Contextual introduction lacks a canonical essay')
    for photo in photos:
        asset = 'public' + photo.get('src', '')
        if asset not in files or digest(files[asset][0]) != photo.get('derivativeSha256'):
            raise ValueError('About photo bytes or provenance mismatch')
        if not all(photo.get(key) for key in ['creator', 'license', 'licenseUrl', 'sourcePage']):
            raise ValueError('About photo attribution is incomplete')
    return {'canonicalEssays': len(canonical), 'contextualIntroductions': len(contextual),
            'aboutPhotographs': len(photos), 'articles': len(articles), 'articleVersions': sum(len(a['locales']) for a in articles),
            'rasterIllustrations': len(illustrations), 'catalogEntities': len(catalog['nodes']),
            'catalogRelationships': len(catalog['edges']),
            'editions': sum(n['type'] == 'edition' for n in catalog['nodes']),
            'trackPositions': sum(n['type'] == 'track' for n in catalog['nodes'])}


def check_git(source: Path, commit: str) -> bool:
    # Avoid treating an exported subdirectory inside an unrelated repository as
    # a checkout of this application.
    if not (source / '.git').exists():
        return False
    def git(*args):
        return subprocess.check_output(['git', '-C', str(source), *args], text=True).strip()
    if git('rev-parse', 'HEAD') != commit:
        raise ValueError('--source-commit must match checkout HEAD')
    if git('status', '--porcelain', '--untracked-files=all'):
        raise ValueError('Source checkout has uncommitted/untracked changes; commit or export clean source first')
    return True


def archive_bytes(files: dict[str, tuple[bytes, int]], root: str, epoch: int) -> tuple[bytes, bytes]:
    entries = {root: None}
    for name, entry in files.items():
        entries[root + '/' + name] = entry
        for parent in PurePosixPath(root + '/' + name).parents:
            if str(parent) != '.':
                entries[str(parent)] = None
    tar_output = io.BytesIO()
    with gzip.GzipFile(filename='', mode='wb', fileobj=tar_output, mtime=epoch, compresslevel=9) as gz:
        with tarfile.open(mode='w', fileobj=gz, format=tarfile.PAX_FORMAT) as archive:
            for name in sorted(entries):
                entry = entries[name]
                info = tarfile.TarInfo(name)
                info.mtime = epoch
                info.uid = info.gid = 0
                info.uname = info.gname = ''
                info.mode = entry[1] if entry else 0o755
                if entry:
                    info.size = len(entry[0])
                    archive.addfile(info, io.BytesIO(entry[0]))
                else:
                    info.type = tarfile.DIRTYPE
                    archive.addfile(info)
    zip_output = io.BytesIO()
    date_time = dt.datetime.fromtimestamp(epoch, dt.timezone.utc).timetuple()[:6]
    with zipfile.ZipFile(zip_output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9, strict_timestamps=True) as archive:
        for name in sorted(entries):
            entry = entries[name]
            info = zipfile.ZipInfo(name if entry else name + '/', date_time=date_time)
            info.create_system = 3
            info.external_attr = ((stat.S_IFREG | entry[1]) if entry else (stat.S_IFDIR | 0o755)) << 16
            if not entry:
                info.external_attr |= 0x10
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, entry[0] if entry else b'', compresslevel=9)
    return tar_output.getvalue(), zip_output.getvalue()


def verify_archives(tar_data: bytes, zip_data: bytes, files: dict[str, tuple[bytes, int]], root: str, epoch: int):
    def safe(name):
        parts = name.rstrip('/').split('/')
        if not parts or parts[0] != root or any(p in ('', '.', '..') for p in parts) or '\\' in name:
            raise ValueError('Unsafe archive member: ' + name)
    found_tar, found_zip = {}, {}
    with tarfile.open(fileobj=io.BytesIO(tar_data), mode='r:gz') as archive:
        names = set()
        for member in archive:
            safe(member.name)
            if member.name in names or not (member.isfile() or member.isdir()):
                raise ValueError('Duplicate, link, or special TAR member')
            names.add(member.name)
            if (member.uid, member.gid, member.uname, member.gname, member.mtime) != (0, 0, '', '', epoch):
                raise ValueError('Nondeterministic TAR metadata')
            if member.isfile():
                found_tar[member.name[len(root)+1:]] = (archive.extractfile(member).read(), member.mode)
    with zipfile.ZipFile(io.BytesIO(zip_data)) as archive:
        names = set()
        if archive.testzip() is not None:
            raise ValueError('ZIP CRC failure')
        for member in archive.infolist():
            safe(member.filename)
            if member.filename in names:
                raise ValueError('Duplicate ZIP member')
            names.add(member.filename)
            if not member.is_dir():
                mode = member.external_attr >> 16
                if not stat.S_ISREG(mode):
                    raise ValueError('Nonregular ZIP member')
                found_zip[member.filename[len(root)+1:]] = (archive.read(member), stat.S_IMODE(mode))
    if found_tar != files or found_zip != files:
        raise ValueError('TAR/ZIP content or permission parity failure')
    manifest = files['SHA256SUMS'][0].decode('utf-8')
    expected = ''.join(digest(data) + '  ' + name + '\n' for name, (data, _) in sorted(files.items()) if name != 'SHA256SUMS')
    if manifest != expected:
        raise ValueError('Checksum manifest mismatch')


def package(source: Path, output: Path, commit: str, epoch: int, name: str = DEFAULT_NAME) -> dict:
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('--source-commit requires the verified full lowercase 40-character Git commit')
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', name):
        raise ValueError('Unsafe package name')
    if not 315532800 <= epoch <= 4294967295:
        raise ValueError('--source-date-epoch must be in the ZIP/GZIP-supported range 1980–2106')
    source = source.resolve(strict=True)
    output = output.resolve()
    if output == source or source in output.parents:
        raise ValueError('Output must be outside the source directory')
    git_checked = check_git(source, commit)
    files = source_files(source)
    metadata = json.loads(files['release.json'][0])
    counts = content_counts(files)
    for key, value in counts.items():
        if metadata.get(key) != value:
            raise ValueError('release.json count mismatch: ' + key)
    metadata['sourceCommit'] = commit
    metadata['sourceCommitNote'] = 'Source commit used for this package; release metadata and SHA256SUMS are generated after checkout.'
    metadata['sourceDateEpoch'] = epoch
    metadata['packageRoot'] = name
    files['release.json'] = ((json.dumps(metadata, ensure_ascii=False, indent=2) + '\n').encode('utf-8'), 0o644)
    files['SHA256SUMS'] = (''.join(digest(data) + '  ' + path + '\n' for path, (data, _) in sorted(files.items())).encode('utf-8'), 0o644)
    tar_data, zip_data = archive_bytes(files, name, epoch)
    verify_archives(tar_data, zip_data, files, name, epoch)
    archives = {name + '.tar.gz': tar_data, name + '.zip': zip_data}
    output.mkdir(parents=True, exist_ok=True)
    result = {'sourceCommit': commit, 'sourceDateEpoch': epoch, 'gitCheckoutVerified': git_checked,
              'files': len(files), 'counts': counts, 'artifacts': {}}
    delivery = {}
    parts_manifest = {'schemaVersion': 1, 'sourceCommit': commit, 'sourceDateEpoch': epoch,
                      'releaseVersion': metadata['version'], 'partBytesLimit': MAX_PART_BYTES,
                      'archives': {}}
    for filename, data in archives.items():
        delivery[filename] = data
        delivery[filename + '.sha256'] = (digest(data) + '  ' + filename + '\n').encode('ascii')
        parts = []
        for index, offset in enumerate(range(0, len(data), MAX_PART_BYTES), 1):
            part_name = filename + '.part' + str(index).zfill(3)
            payload = data[offset:offset + MAX_PART_BYTES]
            delivery[part_name] = payload
            parts.append({'filename': part_name, 'bytes': len(payload), 'sha256': digest(payload)})
        key = 'tar.gz' if filename.endswith('.tar.gz') else 'zip'
        parts_manifest['archives'][key] = {'filename': filename, 'bytes': len(data),
                                         'sha256': digest(data), 'parts': parts}
        result['artifacts'][filename] = {'bytes': len(data), 'sha256': digest(data)}
    delivery[name + '.parts.json'] = (json.dumps(parts_manifest, indent=2) + '\n').encode('utf-8')
    delivery[name + '-reassemble.py'] = REASSEMBLY_SCRIPT.encode('utf-8')
    # Separate per-format delivery manifests permit a TAR-only or ZIP-only transfer.
    for kind in ('tar.gz', 'zip'):
        selected = [name + '.parts.json', name + '-reassemble.py', name + '.' + kind + '.sha256']
        selected += [part['filename'] for part in parts_manifest['archives'][kind]['parts']]
        delivery[name + '.' + kind + '.parts.sha256'] = ''.join(
            digest(delivery[filename]) + '  ' + filename + '\n' for filename in sorted(selected)
        ).encode('ascii')
    for filename, payload in delivery.items():
        # Replace each complete file atomically; never leave a half-written artifact.
        with tempfile.NamedTemporaryFile(dir=output, delete=False) as temp:
            temp.write(payload)
            temporary = Path(temp.name)
        temporary.chmod(0o644)
        os.replace(temporary, output / filename)
    result['delivery'] = {filename: {'bytes': len(payload), 'sha256': digest(payload)}
                          for filename, payload in sorted(delivery.items())}
    result['partsManifest'] = name + '.parts.json'
    result['reassemblyScript'] = name + '-reassemble.py'
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument('--source-commit', required=True)
    parser.add_argument('--source-date-epoch', required=True, type=int, help='Use git show -s --format=%%ct COMMIT')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--name', default=DEFAULT_NAME, help='Archive filename stem and top-level directory')
    args = parser.parse_args()
    try:
        print(json.dumps(package(args.source, args.output, args.source_commit, args.source_date_epoch, args.name), ensure_ascii=False, indent=2))
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        parser.exit(1, 'Release packaging failed: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
