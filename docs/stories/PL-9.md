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

- The lead adds the request shapes to `packages/schema/src/http.ts` before this story starts (`newPasswordSchema` already exists).
