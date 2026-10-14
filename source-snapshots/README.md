# Sites source snapshots

Tracked source exported from the committed Sites repositories on 2026-10-14. These are GitHub backups; edit and deploy through the original hosted checkouts and official Sites workflow. Runtime state, credentials, private account data, and installed dependencies are excluded. Source commit IDs are recorded in revisions.json.

## 2026-10-14 private backup checkpoint

The GPS source snapshot includes the read-only D1/R2 exporter, capture/isolated-restore tooling and tests. Runtime backup grants, service credentials, production backups and private Word documents are excluded. The production export/restore drill passed; current production notes and shopping lists are empty and R2 contains no objects. Nonempty object restore and orphan-object handling are covered by separate local tests.

Operational correction to the snapshot's SYSTEM-BACKUP.md: deleting a runtime secret alone did not revoke the deployed grant during verification. Disable backup access by overwriting the grant with an expired value, deploy the existing saved version, and verify HTTP 401 with the old token. This was completed; no valid backup grant remains active.

Recurring backups, retention, offsite copies and failure notifications were paused at the user's request; no new automation or offsite upload was created. Existing government-price updates remain a separate automation.
