# Interactive Permission Buttons

**Date:** 2026-03-27
**Status:** Approved

## Problem

Permission requests require users to type `yes a1b2c` or `no a1b2c` with a 5-character ID. This is awkward on mobile and error-prone. Slack supports interactive buttons that would make this one-tap.

## Design

### New exports in `permission.ts`

- `formatPermissionBlocks(req)` — Returns Block Kit blocks: section (tool info + input preview), actions (Approve/Deny buttons), context (text fallback `Or reply yes {id} / no {id}`). Also returns the existing plain-text format as the `text` field for notification fallback.
- `formatPermissionResult(req, userId, approved)` — Returns updated blocks with buttons replaced by result text (`:white_check_mark: Approved by <@user>` or `:x: Denied by <@user>`).
- `parseButtonAction(actionId)` — Extracts `{ requestId, behavior }` from action ID strings like `permission_approve_{id}`.

### Changes in `server.ts`

- Permission request handler posts with `blocks` + `text` instead of `text` only.
- New `onInteractive` handler wired through `createSlackClient`:
  1. Acks immediately
  2. Validates clicking user is in `ALLOWED_USER_IDS` — rejects unauthorized users
  3. Parses action ID to extract request ID and approve/deny
  4. Sends permission verdict notification to Claude Code
  5. Calls `web.chat.update()` to replace buttons with result text

### Changes in `slack-client.ts`

- `createSlackClient` accepts a new `onInteractive` callback alongside `onMessage`
- Registers `socketMode.on('interactive', ...)` wired to it
- Interactive handler has its own ack logic but does NOT use the message dedup path

### What doesn't change

- Text-based `yes/no {id}` replies still work
- `parsePermissionReply` untouched
- Thread tracking unaffected
- No new dependencies

### Post-click UX

Clicking a button updates the original message: buttons are replaced with "Approved by @user" or "Denied by @user". Prevents double-clicks and gives clear visual feedback.

### Auth

Button clicks are subject to the same `ALLOWED_USER_IDS` check as text replies. Unauthorized clicks are rejected.

### Testing

- Unit tests for `formatPermissionBlocks`, `formatPermissionResult`, `parseButtonAction`
- Unit test for interactive handler auth rejection
- Existing permission text tests untouched
