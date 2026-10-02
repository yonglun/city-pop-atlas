#!/usr/bin/env bash
# CityPop deployment operator. Does not install packages or alter host security.
set -Eeuo pipefail
umask 077
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
ROOT=''; DRY=0
help() { cat <<'EOF'
Usage: citypop.sh --root /absolute/private/path [--dry-run] COMMAND [ARGS]
  install ARCHIVE.tar.gz EXPECTED_SHA256  Verify and stage first release; edit .env next.
  upgrade ARCHIVE.tar.gz EXPECTED_SHA256  Back up, stop, switch, build and start.
  start                                Validate configuration, build/start services.
  restart                              Recreate services after configuration/secret changes.
  status                               Show Compose status.
  logs                                 Show last 100 app/web log lines.
  stop                                 Stop services; keep data, images and backups.
  backup                               Consistent SQLite backup + metadata/checksum.
  configure-admin                      Read a password privately; does not enable admin.
  restore BACKUP.sqlite --confirm-restore
                                       Back up current DB, stop, verify and restore.
  rollback RELEASE_ID [--backup BACKUP.sqlite --confirm-restore]
                                       Roll back code; explicit backup for schema change.
  --help                               Show this help.
Prerequisites: Bash, Python 3, flock, Docker Engine and Docker Compose v2.
Install Docker yourself: https://docs.docker.com/engine/install/
Compose: https://docs.docker.com/compose/install/linux/
Use a private directory owned by your user; Docker access is root-equivalent.
No automatic TLS, daemon/firewall changes, volume deletion or backup pruning.
EOF
}
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
run() { if ((DRY)); then printf 'DRY-RUN '; printf '%q ' "$@"; printf '\n'; else "$@"; fi; }
while (($#)); do
  case "$1" in
    --root) (($# >= 2)) || die '--root needs a path'; ROOT=$2; shift 2;;
    --dry-run) DRY=1; shift;;
    --help|-h) help; exit 0;;
    *) break;;
  esac
done
(($#)) || { help; exit 1; }
COMMAND=$1; shift
case "$COMMAND" in install|upgrade|start|restart|status|stop|backup|logs|restore|rollback|configure-admin) ;; *) die "unknown command: $COMMAND";; esac
[[ $ROOT == /* && $ROOT != / && $ROOT != *$'\n'* && $ROOT != *$'\r'* && $ROOT != *:*  ]] || die 'choose an absolute private installation directory other than /'
command -v python3 >/dev/null || die 'Python 3 is required (install through your OS package manager)'
command -v flock >/dev/null || die 'flock is required (usually the util-linux package)'
ROOT=$(python3 - "$ROOT" <<'PY'
import os, pathlib, sys
p=pathlib.Path(sys.argv[1])
if '..' in p.parts: raise SystemExit('Parent traversal is not allowed in installation path')
for part in [p, *p.parents]:
    if part.is_symlink(): raise SystemExit('Installation path may not contain symlinks')
if p.exists() and (p.stat().st_uid != os.getuid() or p.stat().st_mode & 0o077):
    raise SystemExit('Installation root must be owned by the operator with mode 0700')
print(p)
PY
)
CURRENT="$ROOT/current"; ENV_FILE="$ROOT/shared/.env"
if ((DRY)); then printf 'DRY-RUN: no files or containers will be changed.\n'; else
  mkdir -p -- "$ROOT"; chmod 700 -- "$ROOT"
  exec 9>"$ROOT/.operator.lock"; flock -n 9 || die 'another deployment operation is running'
fi
check_layout() {
  python3 - "$ROOT" <<'PY'
import os,pathlib,sys
r=pathlib.Path(sys.argv[1])
for name in ('releases','shared','shared/data','shared/secrets','shared/backups'):
    p=r/name
    if p.is_symlink() or (p.exists() and (not p.is_dir() or p.stat().st_uid != os.getuid())):
        raise SystemExit('Unsafe installation directory: '+str(p))
if (r/'shared/.env').is_symlink(): raise SystemExit('The environment file may not be a symlink')
PY
}
check_layout
prereq() {
  command -v docker >/dev/null || die 'Docker is required: https://docs.docker.com/engine/install/'
  docker compose version >/dev/null 2>&1 || die 'Docker Compose v2 is required: https://docs.docker.com/compose/install/linux/'
  docker info >/dev/null 2>&1 || die 'Docker daemon unavailable; ask your host administrator (do not make the socket world-writable)'
}
release_path() {
  python3 - "$ROOT" "$1" <<'PY'
import pathlib,re,sys
root=pathlib.Path(sys.argv[1]); arg=sys.argv[2]
p=(root/'current').resolve() if arg=='current' else root/'releases'/arg
if not re.fullmatch('[0-9a-f]{16}',p.name) or p.parent != root/'releases' or not p.is_dir() or p.is_symlink():
    raise SystemExit('No valid installed release: '+arg)
print(p)
PY
}
compose() {
  local release=$1; shift
  run env CITYPOP_ROOT="$ROOT" CITYPOP_DATA_DIR="$ROOT/shared/data" CITYPOP_BACKUP_DIR="$ROOT/shared/backups" CITYPOP_SECRETS_DIR="$ROOT/shared/secrets" CITYPOP_UID="$(id -u)" CITYPOP_GID="$(id -g)" docker compose --project-name citypop --env-file "$ENV_FILE" -f "$release/compose.yaml" "$@"
}
validate_env() {
  [[ -f $ENV_FILE ]] || die "edit $ENV_FILE before starting"
  python3 - "$ENV_FILE" <<'PY'
import pathlib,sys
p=pathlib.Path(sys.argv[1])
if p.stat().st_mode & 0o077: raise SystemExit('Environment file must have mode 0600')
PY
}
stage() {
  local archive=$1 digest=${2,,}; ID=${digest:0:16}
  python3 "$SCRIPT_DIR/release_guard.py" "$archive" "$digest"
  if ((DRY)); then printf 'DRY-RUN: stage verified release %s under %s/releases\n' "$ID" "$ROOT"; return; fi
  mkdir -p -- "$ROOT/releases" "$ROOT/shared/data" "$ROOT/shared/backups" "$ROOT/shared/secrets"
  if [[ -e $ROOT/releases/$ID || -L $ROOT/releases/$ID ]]; then
    [[ -d $ROOT/releases/$ID && ! -L $ROOT/releases/$ID ]] || die 'release path must be a real directory'
    [[ -f $ROOT/releases/$ID/.archive-sha256 ]] && [[ $(cat "$ROOT/releases/$ID/.archive-sha256") == "$digest" ]] || die 'release ID collision or unverified existing release'
  else
    local tmp; tmp=$(mktemp -d "$ROOT/releases/.staging.XXXXXXXX")
    if ! python3 "$SCRIPT_DIR/release_guard.py" "$archive" "$digest" "$tmp"; then rmdir -- "$tmp" 2>/dev/null || true; die 'release extraction failed; inspect retained staging directory'; fi
    printf '%s\n' "$digest" >"$tmp/.archive-sha256"
    mv -- "$tmp" "$ROOT/releases/$ID"
  fi
}
switch_release() {
  local id=$1
  if ((DRY)); then printf 'DRY-RUN: switch current to releases/%s\n' "$id"; else
    [[ ! -e $ROOT/.current-new && ! -L $ROOT/.current-new ]] || die 'unexpected .current-new entry; inspect before continuing'
    ln -s -- "releases/$id" "$ROOT/.current-new"; mv -Tf -- "$ROOT/.current-new" "$CURRENT"
  fi
}
schema() { python3 - "$1/release.json" <<'PY'
import json,sys
v=json.load(open(sys.argv[1]))['schemaVersion']
if not isinstance(v,int) or v<1: raise SystemExit('Invalid schemaVersion')
print(v)
PY
}
backup() {
  local release=$1 stamp name
  stamp=$(date -u +%Y%m%dT%H%M%SZ); name="citypop-$stamp-$$.sqlite"
  compose "$release" run --rm --no-deps app node production/database-tool.mjs backup /app/runtime/catalog.sqlite "/backups/$name" || return $?
  if ((DRY)); then printf 'DRY-RUN: create and checksum consistent backup %s\n' "$name"; else
    [[ -f $ROOT/shared/backups/$name ]] || die 'backup command returned without producing database'
    python3 - "$ROOT/shared/backups/$name" "$release" <<'PY' || return $?
import hashlib,json,pathlib,sys
p=pathlib.Path(sys.argv[1]); r=pathlib.Path(sys.argv[2]); meta=json.load(open(r/'release.json'))
p.chmod(0o600)
meta.update({'releaseId':r.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
p.with_suffix(p.suffix+'.json').write_text(json.dumps(meta,indent=2)+'\n')
PY
    printf 'Backup: %s\n' "$ROOT/shared/backups/$name"
  fi
}
verify_backup() {
  python3 - "$1" "$2" <<'PY'
import hashlib,json,pathlib,sqlite3,sys
p=pathlib.Path(sys.argv[1]); expected=int(sys.argv[2])
if p.is_symlink() or not p.is_file(): raise SystemExit('Backup must be a regular file, not a symlink')
m=json.load(open(str(p)+'.json'))
if m['schemaVersion'] != expected: raise SystemExit('Backup schema does not match target release; choose a matching backup')
if hashlib.sha256(p.read_bytes()).hexdigest()!=m['sha256']: raise SystemExit('Backup checksum mismatch')
with sqlite3.connect(p.resolve().as_uri()+'?mode=ro',uri=True) as db:
    if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok': raise SystemExit('SQLite integrity check failed')
    if db.execute('PRAGMA foreign_key_check').fetchall(): raise SystemExit('SQLite foreign key check failed')
    if not db.execute("SELECT name FROM sqlite_master WHERE name='_linux_migrations'").fetchone(): raise SystemExit('Not a Linux CityPop database')
print('Backup verified')
PY
}
restore_file() {
  local backup_file=$1
  run python3 - "$backup_file" "$ROOT/shared/data" <<'PY'
import os,pathlib,shutil,sys,tempfile
source=pathlib.Path(sys.argv[1]); data=pathlib.Path(sys.argv[2]); target=data/'catalog.sqlite'
# All containers have been stopped; operator is responsible for stopping other writers.
if target.is_symlink(): raise SystemExit('Database target may not be a symlink')
fd,tmp=tempfile.mkstemp(prefix='.restore-',dir=data); os.close(fd)
shutil.copyfile(source,tmp); os.chmod(tmp,0o600)
with open(tmp,'rb') as f: os.fsync(f.fileno())
# Keep old database and WAL/SHM sidecars for manual recovery, rather than deleting them.
for suffix in ('','-wal','-shm'):
    old=pathlib.Path(str(target)+suffix)
    if old.exists(): old.rename(str(old)+'.before-restore-'+pathlib.Path(tmp).name)
os.replace(tmp,target)
PY
}
case "$COMMAND" in
 install)
  (($#==2)) || die 'install requires ARCHIVE EXPECTED_SHA256'
  stage "$1" "$2"
  if [[ -e $CURRENT || -L $CURRENT ]]; then
    [[ $(release_path current) == "$ROOT/releases/$ID" ]] || die 'another release is installed; use upgrade'
    printf 'This release is already installed; configuration preserved.\n'; exit 0
  fi
  switch_release "$ID"
  if (( ! DRY )); then
    [[ -f $ENV_FILE ]] || cp -- "$ROOT/releases/$ID/.env.example" "$ENV_FILE"
    chmod 600 -- "$ENV_FILE"
  fi
  printf 'Staged. Edit %s, then run start. No services started.\n' "$ENV_FILE";;
 configure-admin)
  (($#==0)) || die 'configure-admin takes no arguments or password on command line'
  release_path current >/dev/null
  if ((DRY)); then printf 'DRY-RUN: read a password privately and save mode0600 in shared/secrets/admin-password.\n'; else
    python3 - "$ROOT/shared/secrets/admin-password" <<'PYADMIN'
import getpass,os,pathlib,sys,tempfile
p=pathlib.Path(sys.argv[1])
try:
    tty=os.open('/dev/tty',os.O_RDWR); os.close(tty)
except OSError: raise SystemExit('An interactive terminal is required; password was not read')
a=getpass.getpass('New admin password (at least 24 characters): ')
b=getpass.getpass('Repeat password: ')
if a != b: raise SystemExit('Passwords differ; nothing changed')
if a != a.rstrip() or len(a)<24 or any(c in a for c in ':\r\n') or any(ord(c)<32 for c in a): raise SystemExit('Use at least 24 characters, with no colon, control characters, or trailing whitespace')
if p.is_symlink(): raise SystemExit('Secret path may not be a symlink')
fd,tmp=tempfile.mkstemp(prefix='.admin-',dir=p.parent)
with os.fdopen(fd,'w') as f: f.write(a+'\n'); f.flush(); os.fsync(f.fileno())
os.chmod(tmp,0o600); os.replace(tmp,p)
print('Password saved privately. Username: citypop.')
PYADMIN
  fi
  printf 'To enable admin, set ADMIN_ENABLED=true in %s and run restart. Keep the admin port loopback-only and use an SSH tunnel.\n' "$ENV_FILE";;
 start|restart|status|stop|backup|logs)
  (($#==0)) || die 'unexpected arguments'; RELEASE=$(release_path current)
  validate_env; ((DRY)) || prereq
  case "$COMMAND" in
    start) compose "$RELEASE" config --quiet; compose "$RELEASE" up -d --build --wait;;
    restart) compose "$RELEASE" config --quiet; compose "$RELEASE" up -d --build --force-recreate --wait;;
    status) compose "$RELEASE" ps;;
    logs) compose "$RELEASE" logs --tail=100 app web;;
    stop) compose "$RELEASE" stop;;
    backup) backup "$RELEASE";;
  esac;;
 upgrade)
  (($#==2)) || die 'upgrade requires ARCHIVE EXPECTED_SHA256'
  OLD=$(release_path current); validate_env; stage "$1" "$2"
  [[ $OLD != "$ROOT/releases/$ID" ]] || { printf 'Already on this release.\n'; exit 0; }
  ((DRY)) || prereq
  compose "$ROOT/releases/$ID" config --quiet
  compose "$OLD" stop
  if ! backup "$OLD"; then die 'backup failed; services remain stopped. Inspect the error and run start on the unchanged current release to resume'; fi
  switch_release "$ID"
  if ! compose "$ROOT/releases/$ID" up -d --build --wait; then
    die "upgrade failed; current points to $ID. Do not blindly roll back after migration. Inspect logs and use the pre-upgrade backup with rollback $([[ -n $OLD ]] && basename "$OLD")."
  fi;;
 restore)
  (($#==2)) && [[ $2 == --confirm-restore ]] || die 'restore requires BACKUP.sqlite --confirm-restore (replaces current data; ensure all external writers stopped)'
  RELEASE=$(release_path current); validate_env; verify_backup "$1" "$(schema "$RELEASE")"; ((DRY)) || prereq
  compose "$RELEASE" stop
  if ! backup "$RELEASE"; then die 'backup failed; services remain stopped with current data unchanged'; fi
  restore_file "$1"
  compose "$RELEASE" up -d --wait;;
 rollback)
  (($#==1 || $#==4)) || die 'rollback requires RELEASE_ID [--backup BACKUP.sqlite --confirm-restore]'
  TARGET=$(release_path "$1"); OLD=$(release_path current); validate_env
  BACKUP=''
  if (($#==4)); then
    [[ $2 == --backup && $4 == --confirm-restore ]] || die 'explicit --backup FILE --confirm-restore required'
    BACKUP=$3; verify_backup "$BACKUP" "$(schema "$TARGET")"
  elif [[ $(schema "$OLD") != "$(schema "$TARGET")" ]]; then
    die 'schema versions differ: supply a backup from the target release and --confirm-restore; newer writes will be lost'
  fi
  ((DRY)) || prereq
  compose "$OLD" stop
  if ! backup "$OLD"; then die 'backup failed; services remain stopped. Inspect the error and run start on the unchanged current release to resume'; fi
  [[ -z $BACKUP ]] || restore_file "$BACKUP"
  switch_release "$(basename "$TARGET")"; compose "$TARGET" up -d --build --wait;;
 *) die "unknown command: $COMMAND";;
esac
