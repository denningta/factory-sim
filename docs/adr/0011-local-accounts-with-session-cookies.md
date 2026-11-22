# ADR-0011: Local accounts with session cookies

- **Status:** Accepted (signed off 2026-11-21)
- **Date:** 2026-11-21

## Context

Self-hosted at a plant; projects must be private per user.

## Decision

Email/password accounts, argon2id hashing, httpOnly secure session cookies stored in Postgres; first startup creates the admin.

## Consequences

- Positive: No external identity provider needed for MVP.
- Negative: No SSO yet; add OIDC/SAML when companies ask.

## Alternatives considered

OIDC only (blocks plants without an identity provider).
