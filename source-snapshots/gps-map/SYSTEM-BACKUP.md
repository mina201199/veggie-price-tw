# Private system backup

Keep this Site owner-private. `/api/system-backup/database`, `/objects`, and `/object` are read-only exports protected by Sites dispatch plus `X-System-Backup-Token`. Configure the runtime secret `SYSTEM_BACKUP_GRANT` as JSON with a cryptographically random 64-character token and an ISO `expiresAt`. Missing, wrong, or expired grants fail closed. Never save either this token or the Sites service bearer in files, commands, Git, logs, or documentation. Grants should expire within two hours; remove the runtime secret and deploy the same saved version after a completed drill.

Use `scripts/system-backup.mjs` through stdin only. Capture JSON fields are `mode: "capture"`, `origin`, `token`, `serviceToken`, `output`. Origin must equal this Site. Output must be a new, ignored private directory. Restore JSON fields are `mode: "restore"`, `backup`, `output`; no network credentials are accepted or used for restoration. Restore uses fresh local Miniflare D1/R2 bindings, never production bindings.

The export includes all user schema and all account rows, SQLite autoincrement sequences, and the entire R2 inventory, including orphan objects. Binary objects are SHA-256 verified; original keys, byte lengths, ETags, upload timestamps, HTTP/custom metadata and storage class are recorded. Restore verifies schema/rows/sequences, exact bytes and restorable metadata plus physical SQLite integrity and foreign keys. Provider-generated upload timestamps, object versions and ETags change after restore. Cloudflare-managed internals and platform credentials are excluded; this is a complete application-storage logical export, not a Cloudflare infrastructure snapshot.

Two database exports and complete object inventories must match across capture. Any missing object, changed ETag, partial inventory, failed request or changed database aborts without a complete manifest. This is a stable-read check, not a distributed point-in-time transaction; capture during a quiet period. Never overwrite an earlier backup on failure. Preserve the source commit, hosting bindings and migrations alongside the backup, without secrets.

Tests: `node --test lib/system-backup.test.mjs scripts/system-backup.test.mjs lib/cloud-notes-server.test.mjs`.

Backups remain outside deployment archives and Git. Store an additional private copy on a separate device/location for disaster recovery; a single local disk is not protection against disk failure. Retention and automatic scheduled backup are separate operational decisions.
