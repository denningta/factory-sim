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
- **Defaults (product owner can change):**
  - Passwords need at least 12 characters (`PASSWORD_MIN_LENGTH`).
  - Sessions expire after **8 hours idle** (`SESSION_IDLE_HOURS`) and after **7 days** in any case (`SESSION_MAX_DAYS`).
  - Both are validated in `apps/api/src/env.ts` and documented in `.env.example`.
- **Sessions (ADR-0011):**
  - Session ids are ≥ 128 bits from a CSPRNG. Postgres stores a **hash** of the id, never the raw value.
  - A new id is issued on login (no fixation).
  - Cookie: httpOnly, `SameSite=Lax`. Set `Secure` behind HTTPS: use Fastify `trustProxy` or an explicit `COOKIE_SECURE` env, and document it in `deploy.md` for TLS-terminating proxies.
  - The role and disabled flag are read from the DB on each request, so demoting or disabling takes effect at once. Disabling a user also deletes their sessions.
- **Sign-in:**
  - Wrong email and wrong password answer `unauthorized` with the same message, **and the same cost**: for an unknown email, verify against a fixed dummy argon2id hash.
  - Disabled users get the same generic answer.
  - Throttle repeated failures per email and IP with backoff and answer `rate_limited` (429). Keep it simple and in memory: one app instance.
- **CSRF:** only accept `application/json` on mutating routes. Don't register form or multipart parsers.
- **First-admin setup:** allowed only while no admin exists, enforced atomically (transaction plus a unique or partial constraint), so concurrent setups can't create two admins. After that it answers 409 `conflict`. `deploy.md`: complete setup right after the first start, because whoever reaches a fresh install first becomes admin.
