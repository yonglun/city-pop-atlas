# Source synchronization · 2026-10-03 · v25

This update brings the completed Piper edition collection and all 44 trilingual
song essays into the existing Linux-compatible public source. It preserves the
separate administrator listener, authoritative server authentication flag,
review counters, data overlays and audited deployment/rollback safeguards.

- 755 layered entities and 1,117 relationships.
- 44 exact editions cover all 41 album concepts, with 476 ordered positions.
- 44 songs now have original Chinese, English and Japanese essays: 128 essays
  and 384 language versions in total.
- The original 84 essays and 84 illustration binaries are unchanged.
- Source provenance and version/side/title qualifications remain attached to
  the collection records. Track positions do not imply new recordings or songs.
- Linux production remains read-only on the public listener, with a separate
  Basic Auth administrator listener and exact Host/Origin checks.
- Site-scoped administrator configuration remains server-only and is absent
  from this repository and the Linux packages.
- No live databases, owner corrections, audit rows, credentials, private
  deployment metadata or research caches are included.
- The reproducible Linux package command builds TAR.GZ, ZIP and SHA-256 sidecars
  from an explicit public source commit; the package contains the prebuilt
  runtime, complete maintainable source, a stamped release manifest and checksums.
- Publishing GitHub source or preparing packages does not deploy the Site or
  any Linux server. Existing private D1 edits require a separately authorized
  export and reconciliation; they are not silently substituted with seed data.

See [deployment](DEPLOYMENT.md), [operator scripts](../deploy/scripts/README.md)
and [verification](VERIFICATION.md) for current commands and tested boundaries.
