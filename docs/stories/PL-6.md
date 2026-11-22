---
id: PL-6
epic: Platform
points: 5
priority: Must
sprint: 2
depends_on: [PL-1]
builder_model: sonnet
owner: builder
issue: 22
---

# PL-6: Sign in with my own account

**Story:** As an engineer, I want to sign in with my own account so that my projects are private to me.

## Acceptance criteria

- [ ] First startup prompts for an admin account
- [ ] Users sign in with email and password; passwords are stored hashed
- [ ] Sessions expire after inactivity; users can sign out
- [ ] An admin can create and disable users

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **Contract (lead):** request, response and error shapes, plus the route table, are in `packages/schema/src/http.ts`. Validate requests with them and generate OpenAPI from them (ADR-0003). Don't hand-write shapes.
- **Defaults (product owner can change):** passwords need at least 12 characters (`PASSWORD_MIN_LENGTH`). Sessions expire after **8 hours idle**, configurable with `SESSION_IDLE_HOURS`, which is validated in `apps/api/src/env.ts` and documented in `.env.example`.
- Cookie: httpOnly, `SameSite=Lax`, `Secure` when served over HTTPS. Session rows live in Postgres (ADR-0011). Disabling a user deletes their sessions. Wrong email and wrong password both answer `unauthorized` with the same message.
- The first-admin setup is allowed only while no admin exists. After that it answers 409 `conflict`.
