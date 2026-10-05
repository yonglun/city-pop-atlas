# Deployment operator scripts

`citypop.sh` is an operator-invoked Bash script, not a host installer. Requirements: Bash, Python 3 with SQLite support, `flock` (util-linux), Docker Engine and Docker Compose v2 with `up --wait`. Install Docker through the [official instructions](https://docs.docker.com/engine/install/) and [Compose instructions](https://docs.docker.com/compose/install/linux/). The script never installs packages, changes a firewall/daemon, or grants Docker access. Docker socket access is effectively root-level access; do not make it world-writable.

## Interface

```sh
bash deploy/scripts/citypop.sh --help
bash deploy/scripts/citypop.sh --root "$HOME/citypop" --dry-run install /path/release.tar.gz EXPECTED_SHA256
bash deploy/scripts/citypop.sh --root "$HOME/citypop" install /path/release.tar.gz EXPECTED_SHA256
# Edit $HOME/citypop/shared/.env before start. Defaults remain loopback-only.
bash "$HOME/citypop/current/deploy/scripts/citypop.sh" --root "$HOME/citypop" start
bash "$HOME/citypop/current/deploy/scripts/citypop.sh" --root "$HOME/citypop" status
bash "$HOME/citypop/current/deploy/scripts/citypop.sh" --root "$HOME/citypop" logs
bash "$HOME/citypop/current/deploy/scripts/citypop.sh" --root "$HOME/citypop" stop
```

All global options precede the command. Use an absolute private installation root owned by the operator, mode 0700, without symlinks, colon, newline or parent traversal. Paths containing spaces are supported. The script injects the operator's current UID/GID and absolute data/secrets/backups paths into Compose. Run as the same operator every time. Use a dedicated non-root account with authorized Docker access where practical. No chown is required.

`install` verifies/stages only; it never starts containers. Installing the same archive again preserves configuration and reports already installed. A different installed release requires `upgrade`. Each installation uses the fixed Compose project name `citypop`; do not create multiple independent installations on one Docker daemon with these defaults.

Layout:

- `releases/<first 16 SHA-256 characters>/`: extracted release
- `current`: atomic symlink to the active release
- `shared/.env`: operator configuration, mode 0600
- `shared/data/catalog.sqlite`: persistent SQLite data
- `shared/secrets/admin-password`: optional supplied secret, mode 0600
- `shared/backups/*.sqlite` and matching `.sqlite.json`: persistent consistent backups and checksummed metadata

The install root and all created directories are private to the operator. Release files are mode 0600, or 0700 for executable source files. A lock prevents simultaneous modifying operations through this script. Do not start a second Compose project or another process writing to this database.

## Integrity and safe extraction

The expected outer SHA-256 must come from the release publisher over a trusted channel. A checksum obtained from the same untrusted download does not authenticate a release. Verify the archive's published checksum before using ordinary tar to access its scripts; never execute a script from an untrusted archive merely to ask that script to verify itself.

The script's Python helper rechecks the outer SHA-256, requires one top-level package directory and a complete `SHA256SUMS` manifest, and rejects absolute paths, traversal, duplicate names, control characters, links and device/special files. Extraction is into a new private empty directory, never using archive-supplied ownership or permissions. Archive limits: 50,000 entries and 1 GiB expanded content. This accepts `.tar.gz`, not ZIP. Publisher metadata at the package root must include `release.json` with an integer `schemaVersion`.

## Administration

Public mode is read-only by default. To opt in:

```sh
bash "$HOME/citypop/current/deploy/scripts/citypop.sh" --root "$HOME/citypop" configure-admin
# Edit shared/.env: ADMIN_ENABLED=true
bash "$HOME/citypop/current/deploy/scripts/citypop.sh" --root "$HOME/citypop" restart
```

The helper requires an interactive terminal, reads the password without echo, asks twice, and does not take a password as a command-line argument. Supply at least 24 characters; no colon, control characters or trailing whitespace. No secret ships in the package. Username: `citypop`. `restart` recreates the services so rotated secrets are reloaded. Keep admin bound to 127.0.0.1:8081. Use an SSH tunnel, e.g. `ssh -L 8081:127.0.0.1:8081 operator@YOUR_SERVER`, then open `http://127.0.0.1:8081`. Exact configured Host/Origin checks apply. Never expose admin Basic authentication through public unencrypted HTTP.

`PUBLIC_ORIGIN`, public bind/port and optional admin settings live in `shared/.env`. Set the actual public origin yourself; no domain is guessed. The package's separate Nginx guidance covers an existing certificate/proxy. These scripts do not enroll an ACME account or provision TLS.

## Backup, upgrade, restore and rollback

```sh
bash "$HOME/citypop/current/deploy/scripts/citypop.sh" --root "$HOME/citypop" backup
bash "$HOME/citypop/current/deploy/scripts/citypop.sh" --root "$HOME/citypop" upgrade /path/new-release.tar.gz EXPECTED_SHA256
bash "$HOME/citypop/current/deploy/scripts/citypop.sh" --root "$HOME/citypop" restore /absolute/path/backup.sqlite --confirm-restore
bash "$HOME/citypop/current/deploy/scripts/citypop.sh" --root "$HOME/citypop" rollback OLD_RELEASE_ID
# When schemas differ, restore a backup taken with the target release explicitly:
bash "$HOME/citypop/current/deploy/scripts/citypop.sh" --root "$HOME/citypop" rollback OLD_RELEASE_ID --backup /absolute/path/backup.sqlite --confirm-restore
```

Standalone `backup` uses `production/database-tool.mjs` and Node 24's SQLite online backup API in a one-shot container. It is WAL-aware and safe while the application runs. The resulting database has SHA-256 metadata identifying its source release and declared schema version. Backups stay outside releases. Copy both database and JSON sidecar to an operator-approved protected off-host destination for disaster recovery; these scripts do not transmit or prune them. The backup contains application records and audit history. Configuration, secrets, TLS certificates and any separate external storage need their own protected backup procedure.

`upgrade` validates the new archive and Compose configuration, stops the old services, makes the final consistent backup with no app writes in flight, switches the symlink, builds and starts with health waiting. This causes downtime; building the image can take time. It does not silently undo migrations after failure. If backup fails, the old release remains selected and stopped: inspect the error, then `start` it to resume. If new startup fails, inspect `logs`, keep the backup and use the matching rollback procedure. No automatic deletion or pruning occurs.

`restore` checks the JSON checksum, schema version, SQLite integrity, foreign keys and migration table, then stops services and backs up current data. It requires `--confirm-restore`; newer data may be lost. After stopping all application writers, it copies the chosen backup to a fresh mode-0600 file and atomically replaces the database. Previous database and WAL/SHM sidecars are retained as `.before-restore-*` recovery files. It then starts services. If current data is too corrupt to back up, the script intentionally stops and requires manual recovery by an experienced operator instead of silently discarding it.

A code-only `rollback` is permitted only when the two release metadata schema versions match. Maintainers must increment `schemaVersion` for incompatible migrations and retain target-release backups. A differing version requires the target-schema backup plus explicit restore confirmation; newer writes are lost. The tool cannot prove semantic compatibility of an incorrectly labeled future migration. Never bypass the check by editing metadata.

`--dry-run` validates inputs where possible and prints intended commands without writing files or contacting Docker. It does not demonstrate Docker/network/permissions/health correctness. `stop` only stops containers. No command runs `down -v`, removes a volume, deletes a release, or prunes backups.

## Regression checks and scope

```sh
bash -n deploy/scripts/citypop.sh
python3 deploy/scripts/test_scripts.py
node tests/deployment.mjs
# Independently verify and extract the old archive first; use no real user DB.
node tests/linux-upgrade.mjs /absolute/path/to/verified-old-release
```

The eight isolated operator tests use synthetic archives, real small SQLite fixtures and a fake Docker executable. They cover archive checksums, traversal/absolute/link/duplicate rejection, no-write dry runs, paths with spaces, repeat install, start/restart/status/logs/stop command construction, private config/backup permissions, backup metadata, refusal of unconfirmed restore, retained pre-restore files, upgrade, migration-aware rollback, checksum-tampered backup rejection, unsafe-root rejection, stop-before-backup ordering, failed-backup-after-output handling and failed-metadata handling (old release stays selected and services stay stopped). The same-schema upgrade/rollback regression confirms that newer synthetic user edits and audit rows are retained and no database restore occurs implicitly.

The separate Node tests use real loopback HTTP listeners and real temporary SQLite databases, with a newly randomized disposable password for every run. The upgrade drill uses the supplied verified old release, approves and rejects fictional claims, leaves one pending, approves a fictional structural entity, validates an online WAL-aware backup, upgrades the same database, makes another edit, rolls back code without restoring data, and upgrades again. It checks exact prior private-table rows and effective public values throughout, including the edit made after upgrade. The known original 20261003 package and 20261003-v25 keep the same four SQL migrations; both declare schema version 1. Updated base snapshots can change which overlays are applicable, so inspect the private review queues for conflicts after changing code versions.

These checks do not build/run real containers, exercise a real Docker daemon, validate Nginx/TLS/SSH routing, use real admin credentials or user databases, or simulate disk exhaustion/power loss. Real platform smoke tests and recovery drills remain required before production use.

Changelog for 20261003: added private release staging, digest and manifest verification, stable Compose identity, operator UID/GID persistence, consistent backups, explicit atomic restore, migration-aware rollback, optional terminal-only admin secret setup, diagnostics, dry-run and isolated regression tests.

Changelog for 20261003-v25: refreshed release contents and strengthened local authentication and upgrade/rollback regression coverage. The operator interface and explicit-restore requirement are unchanged.

Changelog for 20261004-v26: English is the first-visit and fallback language. Explicit saved Chinese, English and Japanese preferences are preserved. This is a code-only update with the same schema and operator interface.

Changelog for 20261005-v27: complete trilingual editorial coverage, 128 distinct illustrations, licensed About photographs, reduced-motion-aware default graph rotation, and consent-first optional analytics. The same database schema and upgrade/rollback interface preserve existing shared configuration and data. Blank analytics IDs are optional; existing .env files do not need replacement.


Changelog for 20261005-v33: the cumulative public snapshot now contains 1,226 entities, 1,711 base relationships, 1,226 trilingual introductions (208 canonical essays and 1,018 contextual introductions), 3,678 locale versions, 208 distinct illustrations, 3 licensed About photographs, 76 editions, and 835 track positions. Schema version 1 and the four existing SQL migrations remain unchanged. Upgrade preserves the exact existing shared/.env bytes, PUBLIC_ORIGIN, database, private overlays, decisions, and audit tables; applicability of overlays still requires review against the updated base snapshot.

## Large-release delivery parts

The publisher retains complete TAR.GZ and ZIP archives plus SHA-256 files. `scripts/package-release.py` also writes deterministic parts of at most 15,000,000 bytes for each format, a common `.parts.json` manifest, a standalone `-reassemble.py` helper, and a `.parts.sha256` delivery checklist for each format. The prebuilt runtime and source are included without byte rewrites. Parts are transport files, not independently extractable archives.

For TAR-only delivery, put all `.tar.gz.partNNN` files, `.tar.gz.parts.sha256`, `.tar.gz.sha256`, `.parts.json` and `-reassemble.py` in one fresh directory. Obtain the helper and checksums through the trusted release channel. In that directory:

```sh
set -e
NAME=city-pop-linux-deploy-20261005
sha256sum -c "$NAME.tar.gz.parts.sha256"
python3 "$NAME-reassemble.py" "$NAME.parts.json" tar.gz
sha256sum -c "$NAME.tar.gz.sha256"
```

The helper requires Python 3.8+ only. It validates every part and the complete archive before publishing the output atomically; missing, corrupt, truncated, reordered or unsafe parts fail closed. An existing different file is never overwritten. `--verify-only` checks all parts without creating an archive. To reassemble the ZIP, use the equivalent ZIP parts/checklist and replace `tar.gz` with `zip`. Full archives remain available, so reassembly is unnecessary when a full archive was delivered. Follow `docs/DEPLOYMENT.md` for exact install/upgrade commands and `.env` byte-for-byte preservation checks. None of these packaging checks constitutes a real Linux or Docker deployment.
