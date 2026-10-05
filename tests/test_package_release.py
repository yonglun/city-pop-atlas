"""Standard-library tests for release isolation, provenance, and reproducibility."""
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import tarfile
import tempfile
import unittest
import zipfile

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/package-release.py'
spec = importlib.util.spec_from_file_location('package_release', SCRIPT)
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)


class PackageReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'source'
        self.source.mkdir()
        self.commit = 'a' * 40
        self.epoch = 1791028800
        for name in packager.ROOT_FILES | {'production/server.mjs', 'production/sqlite.mjs',
                'production/database-tool.mjs', 'data/catalog.json', 'public/articles.json',
                'data/illustration-provenance.json', 'public/about.json', 'data/about-photo-provenance.json', 'deploy/scripts/citypop.sh',
                'deploy/scripts/release_guard.py', 'dist/server/index.js', 'secrets/.gitkeep'}:
            self.write(name, b'' if name == 'secrets/.gitkeep' else b'fixture\n')
        self.write('data/catalog.json', json.dumps({'nodes': [{'type': 'edition'}, {'type': 'track'}], 'edges': []}))
        self.write('public/articles.json', json.dumps([{'entityId': 'fixture', 'locales': {'zh': {}, 'en': {}, 'ja': {}}, 'illustration': {'src': '/illustrations/fixture.webp'}}]))
        self.write('data/illustration-provenance.json', '[{}]')
        self.write('public/illustrations/fixture.webp', b'public image fixture')
        self.write('public/about.json', json.dumps({'locales': {'zh': {}, 'en': {}, 'ja': {}}}))
        self.write('data/about-photo-provenance.json', '[]')
        self.metadata = {'sourceCommit': None, 'articles': 1, 'articleVersions': 3,
                         'rasterIllustrations': 1, 'canonicalEssays': 1, 'contextualIntroductions': 0, 'aboutPhotographs': 0, 'catalogEntities': 2,
                         'catalogRelationships': 0, 'editions': 1, 'trackPositions': 1}
        self.write('release.json', json.dumps(self.metadata))
        (self.source / 'deploy/scripts/citypop.sh').chmod(0o700)

    def write(self, name, data):
        target = self.source / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data.encode() if isinstance(data, str) else data)
        return target

    def build(self, out='output', **overrides):
        options = dict(source=self.source, output=self.root / out, commit=self.commit, epoch=self.epoch)
        options.update(overrides)
        return packager.package(**options)

    def test_deterministic_archives_modes_manifest_and_source_unchanged(self):
        before = (self.source / 'release.json').read_bytes()
        first = self.build('one')
        for path in self.source.rglob('*'):
            os.utime(path, (self.epoch + 999, self.epoch + 999))
        (self.source / 'README.md').chmod(0o600)
        second = self.build('two')
        self.assertEqual(first, second)
        for name in first['artifacts']:
            self.assertEqual((self.root / 'one' / name).read_bytes(), (self.root / 'two' / name).read_bytes())
        self.assertEqual((self.source / 'release.json').read_bytes(), before)
        with tarfile.open(self.root / 'one' / (packager.DEFAULT_NAME + '.tar.gz')) as archive:
            script = archive.getmember(packager.DEFAULT_NAME + '/deploy/scripts/citypop.sh')
            self.assertEqual(script.mode, 0o755)
            readme = archive.getmember(packager.DEFAULT_NAME + '/README.md')
            self.assertEqual(readme.mode, 0o644)
            manifest = archive.extractfile(packager.DEFAULT_NAME + '/SHA256SUMS').read().decode()
            self.assertNotIn('  SHA256SUMS\n', manifest)
            release = json.load(archive.extractfile(packager.DEFAULT_NAME + '/release.json'))
            self.assertEqual(release['sourceCommit'], self.commit)
            self.assertEqual(release['sourceDateEpoch'], self.epoch)

    def test_private_generated_runtime_and_dependency_files_excluded(self):
        excluded = ['.env', '.env.local', '.openai/metadata.json', '.local/auth.json',
                    'runtime/catalog.sqlite', 'backups/private.sqlite', 'secrets/admin-password',
                    'server/assets.generated.js', 'scripts/__pycache__/x.pyc',
                    'tests/private.sqlite', 'data/dump.db', 'dist/unused.js',
                    'data/secrets/credential.txt', 'scripts/secrets/credential.txt', 'data/live-baseline.json', 'tests/live-baseline.json']
        for name in excluded:
            self.write(name, 'must-not-ship')
        (self.source / 'node_modules').symlink_to(self.root, target_is_directory=True)
        self.build()
        with zipfile.ZipFile(self.root / 'output' / (packager.DEFAULT_NAME + '.zip')) as archive:
            for name in excluded:
                self.assertNotIn(packager.DEFAULT_NAME + '/' + name, archive.namelist())
            for name in archive.namelist():
                self.assertNotIn(b'must-not-ship', archive.read(name))

    def test_missing_contextual_canonical_rejected(self):
        articles = json.loads((self.source / 'public/articles.json').read_text())
        articles[0].update(kind='contextual', canonicalEntityId='missing')
        self.write('public/articles.json', json.dumps(articles))
        with self.assertRaisesRegex(ValueError, 'canonical essay'):
            self.build()

    def test_about_photo_integrity_and_attribution_rejected(self):
        self.write('data/about-photo-provenance.json', '[{"src":"/photos/missing.webp"}]')
        with self.assertRaisesRegex(ValueError, 'photo bytes'):
            self.build()

    def test_missing_article_image_rejected(self):
        (self.source / 'public/illustrations/fixture.webp').unlink()
        with self.assertRaises(ValueError):
            self.build()

    def test_source_symlink_rejected(self):
        (self.source / 'public/escape').symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'Symlinks'):
            self.build()

    def test_fixed_path_symlinked_parent_rejected(self):
        for directory in ['dist', 'dist/server', 'secrets']:
            with self.subTest(directory=directory):
                original = self.source / directory
                outside = self.root / 'outside'
                original.rename(outside)
                original.symlink_to(outside, target_is_directory=True)
                try:
                    with self.assertRaisesRegex(ValueError, 'absent or unsafe'):
                        self.build()
                finally:
                    original.unlink()
                    outside.rename(original)

    def test_empty_placeholder_required(self):
        self.write('secrets/.gitkeep', 'unexpected secret')
        with self.assertRaisesRegex(ValueError, 'must be empty'):
            self.build()

    def test_count_drift_rejected(self):
        self.metadata['articles'] = 999
        self.write('release.json', json.dumps(self.metadata))
        with self.assertRaisesRegex(ValueError, 'count mismatch'):
            self.build()

    def test_locale_drift_rejected(self):
        self.write('public/articles.json', '[{"locales":{"zh":{}}}]')
        with self.assertRaisesRegex(ValueError, 'locales'):
            self.build()

    def test_missing_bundle_rejected(self):
        (self.source / 'dist/server/index.js').unlink()
        with self.assertRaisesRegex(ValueError, 'Required release file'):
            self.build()

    def test_bad_provenance_output_path_and_name_rejected(self):
        for changes in [{'commit': 'main'}, {'epoch': 0}, {'name': '../escape'},
                        {'output': self.source / 'output'}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.build(**changes)

    def test_tampered_tar_rejected_by_parity_verifier(self):
        files = {'README.md': (b'original', 0o644)}
        files['SHA256SUMS'] = ((packager.digest(b'original') + '  README.md\n').encode(), 0o644)
        tar_data, zip_data = packager.archive_bytes(files, 'package', self.epoch)
        changed = {**files, 'README.md': (b'tampered', 0o644)}
        with self.assertRaisesRegex(ValueError, 'parity'):
            packager.verify_archives(tar_data, zip_data, changed, 'package', self.epoch)


if __name__ == '__main__':
    unittest.main()
