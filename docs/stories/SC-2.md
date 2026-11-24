---
id: SC-2
epic: Scenarios & projects
points: 2
priority: Should
sprint: 7
depends_on: [SC-1]
builder_model: sonnet
owner: builder
issue: 71
---

# SC-2: Sign in again without losing unsaved edits

**Story:** As a manufacturing engineer, I want to sign back in when my session expires without losing my edits.

## Acceptance criteria

- [ ] When the session expires during editing, a sign-in dialog opens over the editor and keeps the editor state; after signing in, the pending save is retried
- [ ] Test: an expired session mid-edit, then signing in through the dialog, saves the edits with no page reload

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ from the review of #69 (issue #71). Uses the existing login route; no API change.
- _Builder:_ an `unauthorized` save error now puts the autosaver in a `signin` status: edits stay dirty, no retry timer. The existing `SignIn` form shows in a modal dialog over the (inert) editor; on success `saver.resume()` retries the save. Editor is not unmounted, so state is kept.
