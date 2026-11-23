---
id: PL-9
epic: Platform
points: 3
priority: Must
sprint: 3
depends_on: [PL-6]
builder_model: sonnet
owner: builder
issue: 59
---

# PL-9: Change or reset a password

**Story:** As a user, I want to change my password, and as an admin, I want to reset a user's password, so that accounts stay secure after the admin hands out a first password.

_Added by the lead with product-owner approval (2026-11-22), from the review of the PL-6 contract (#56)._

## Acceptance criteria

- [ ] A signed-in user can change their password by entering their current password and a new one that meets the password policy
- [ ] An admin can set a new password for another user
- [ ] Changing or resetting a password ends that user's other sessions

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **Contract (lead):** `changePasswordRequestSchema` (`POST /api/auth/password`) and `resetPasswordRequestSchema` (`PUT /api/users/:id/password`, admin) are in `packages/schema/src/http.ts`, both answering 204. An admin resetting their own account gets 403; they use the change flow.
- Also in scope: answer non-JSON bodies with the new `unsupported_media_type` (415) code instead of `validation` (`apps/api/src/http-error.ts`, from the PL-6 review).
- **AC3 reading:** when a user changes their own password, all their sessions _except the current one_ end. When an admin resets someone's password, _all_ of that user's sessions end.
- A wrong current password answers `unauthorized`. The sign-in throttle (`rate_limited`) also applies to the change endpoint, so it can't be used to guess passwords.
- An admin changing their _own_ password uses the change flow (current password required), not the reset.
