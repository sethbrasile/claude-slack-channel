---
phase: 3
name: DevOps & Publishing Fixes
type: qc-fix
findings: QC-1-08, QC-1-09, QC-1-10
---

## Goal

Fix package publishing configuration and add release automation so the package can be correctly published with CI gates.

## Findings Addressed

- **QC-1-08 (high):** `engines.bun` set to `>=1.1.0` but `saveTextLockfile = true` requires Bun 1.2+. Change to `>=1.2.0`.
- **QC-1-09 (high):** Missing `files` field (npm publishes everything including docs/, .github/, coverage/) and missing `prepublishOnly` script (no test gate before publish). Add both per research doc.
- **QC-1-10 (high):** No release.yml task — research doc specifies tag-triggered GitHub Release + npm publish workflow but plan has no task for it. Add Task 9b or extend Task 9.

## Scope

- docs/implementation-plan.md Task 1 (lines ~52-76) — package.json spec
- docs/implementation-plan.md Task 9 (lines ~1155-1200) — CI configuration

## Success Criteria

- [ ] `engines.bun` changed to `>=1.2.0`
- [ ] `files` field added: `["src", "README.md", "LICENSE"]`
- [ ] `prepublishOnly` script added: `bunx tsc --noEmit && bun test`
- [ ] release.yml task added with tag-triggered workflow from research doc
