---
phase: 1
name: Integration Spec Rewrite
type: qc-fix
findings: QC-1-01, QC-1-03, QC-1-04, QC-1-07
---

## Goal

Eliminate all integration ambiguity by rewriting Task 7 of docs/implementation-plan.md as a complete, copy-pasteable `server.ts` file rather than prose + code fragments.

## Findings Addressed

- **QC-1-01 (critical):** Missing server.notification() code — add code blocks for both `notifications/claude/channel` (inbound messages) and `notifications/claude/channel/permission` (verdict relay)
- **QC-1-03 (high):** Permission verdict flow ambiguity — make mutual exclusivity explicit: if `parsePermissionReply()` matches, send verdict notification and `return` without forwarding as channel notification
- **QC-1-04 (high):** Permission threading breaks ThreadTracker — resolve whether permission prompts post in-thread or top-level, and align tracker state accordingly
- **QC-1-07 (high):** Reply tool startThread on every reply — clarify whether `startThread` should only fire for questions, not all top-level replies

## Scope

- docs/implementation-plan.md Task 7 (lines ~935-1058)
- Also address M22 (shutdown handler duplication) by explicitly noting Task 2's handler is replaced

## Success Criteria

- [ ] Task 7 contains a complete `server.ts` file, not prose + fragments
- [ ] `server.notification()` calls present for both notification types with correct param shapes
- [ ] Verdict parsing returns early without forwarding to channel
- [ ] Permission prompt threading decision is explicit and consistent with ThreadTracker
- [ ] startThread semantics documented — only for questions or all replies
- [ ] Task 2 shutdown handler explicitly marked as replaced by Task 7

## Propagation Verification

After each edit, search all documents in scope for remaining occurrences of the broken form. The phase is not complete until all searches return zero results.
