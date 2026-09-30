# Household Membership Roles — Specification

**Status:** Draft
**Version:** 0.2
**Backlog item:** A3 (Phase 1.2)
**Depends on:** A4 (internal feed pattern, `permitAll` internal surface closed by A1)

Task breakdown: [../tasks/4_membership_roles_tasks.md](../tasks/4_membership_roles_tasks.md).

## 1. Overview

MVP allows exactly one user per household: whoever creates a household is
its `OWNER`, the only person who can see or operate it. Real households
have several people entering readings for the same meters.

This document specifies the invite → accept flow, member management, and
the role model that decides who can do what inside a household. It also
closes the biggest authorization gap in the system: meter and reading
services currently verify the household *exists*, not that the requesting
user *belongs* to it.

## 2. Goals

- Several users share one household; each sees the same meters and readings.
- The household owner controls membership: can invite, can remove members.
- Role-aware authorization enforced end to end — household, meter, and
  reading services all reject requests from users without sufficient access.
- The existing single-owner behavior keeps working: creating a household makes
  you OWNER, exactly as today.

### Non-goals

- Email/SMS/Telegram delivery of invites (invite links are shared out of
  band — copy-paste; delivery channels are Phase 3).
- Fine-grained per-meter permissions.
- Role changes for existing members beyond removal + re-invite (an upgrade
  path exists, but is not required this phase).
- Household ownership transfer.
- Multi-household membership limits beyond existing ones.

## 3. Roles

Three roles, matching `docs/service-boundaries.md` §Household Roles:

| Role     | Capabilities                                                                                                                        |
|----------|-------------------------------------------------------------------------------------------------------------------------------------|
| `OWNER`  | Everything `MEMBER` can do, plus: manage members (invite, remove), delete household. Exactly one per household (the creator).       |
| `MEMBER` | View household, meters, readings; create/modify meters; submit readings. Cannot manage members or invites. Cannot delete household. |
| `VIEWER` | Read-only: view household, meters, and readings.                                                                                    |

Rules:

- A user has at most one membership per household (`household_id + user_id`
  unique).
- The creator's membership is `OWNER`; the role cannot be edited.
- Removing the owner is rejected (`409`), not demoted.
- Every authorization check resolves through the requester's membership role;
  no user is implicitly trusted for being authenticated.

## 4. Invite flow

There is no delivery channel, so invites are codes the owner shares manually.

1. `OWNER` (owner-only this phase — see §11) creates an invitation for a
   target role (`MEMBER` or `VIEWER`).
2. The invite is a single-use opaque code with an expiry (7 days default).
3. The invitee redeems the code while authenticated; a membership with the
   invite's role is created for them.
4. Redeeming an already-used or expired code fails with a clear problem
   (`409`/`410` respectively); codes are not extended.
5. A household may hold a small bounded number of live invites (e.g. 10) to
   prevent code-list spam.

An invitation grants membership only after redemption by an authenticated user —
knowing the code is not by itself access.

## 5. User stories

### Household OWNER
- I can create an invitation for `MEMBER` or `VIEWER`.
- I can list my household's members and live invites.
- I can revoke a live invite.
- I can remove a member (not myself, not via demotion).
- I can delete the household (existing behavior, owner-only now explicit).

### Invitee
- I can redeem an invitation code and immediately see the household.
- If I am already a member, redeeming again is a no-op success (idempotent),
  not an error — people re-share codes into their own household.
- I cannot see member management, invites, or household deletion.

### VIEWER
- I read everything in the household.
- Writes (meters, readings) are rejected with a role-specific problem
  (`FORBIDDEN_ROLE`), distinguishable from "not a member at all".

## 6. Functional requirements

### 6.1 Household service (source of truth)

Owns membership and invites. New/changed API (contract-first, always):

- `POST /api/v1/households/{householdId}/invites` — create invite (owner).
- `GET /api/v1/households/{householdId}/invites` — list live invites (owner).
- `DELETE /api/v1/households/{householdId}/invites/{inviteId}` — revoke (owner).
- `POST /api/v1/households/invites/redeem` — redeem a code (any authenticated user).
- `GET /api/v1/households/{householdId}/members` — list members (any member).
- `DELETE /api/v1/households/{householdId}/members/{userId}` — remove member (owner).
- `GET /api/v1/households` — response gains caller's role per household
  (replaces implicit "I own everything returned").

Internal (service-to-service, same `permitAll`-until-A1 surface as the
revocation feed):

- `GET /api/v1/internal/household-access?householdId=&userId=` — returns a
  caller-independent access verdict `{role, exists}` for a user/household pair.
  Cached-safe: membership changes are rare; a short TTL (30 s) is acceptable.
  This is a *narrow* accessor — membership details stay inside the household
  service.

Data model changes:

- `MembershipRole` gains `VIEWER` (migration enum/check constraint).
- New `household_invites` table: `id`, `household_id`, `role`, `code_hash`,
  `created_by`, `expires_at`, `redeemed_at` (nullable), `redeemed_by`
  (nullable). Codes stored hashed (same discipline as refresh tokens).

### 6.2 Meter service

- Replaces the household-existence check with an access check through the
  internal endpoint above: reads require any membership role; meter
  creation/modification requires `MEMBER` or `OWNER`.
- `VIEWER` gets `403 FORBIDDEN_ROLE`.

### 6.3 Reading service

- Same access check on the reading path: reads need any role, submissions need
  `MEMBER`+ (resolution via meter → household; check happens per request,
  same short-TTL cache).

### 6.4 Frontend

- Household switcher/views unchanged; households where the user is `VIEWER`
  hide write affordances (add-meter, submit-reading) instead of letting the
  API reject.
- New "Members" surface: member list, invite creation (copy code), invite
  list + revoke. Owner-only visibility.
- Redeem flow: pasting an invitation code (e.g. after login redirect) adds
  the household to the user's list.

## 7. Authorization matrix (enforced where marked)

| Action                                     | Household svc | Meter svc     | Reading svc |
|--------------------------------------------|---------------|---------------|-------------|
| View household / meters / readings         | member+       | — (delegates) | member+     |
| Create/modify meter                        | —             | MEMBER+       | —           |
| Submit reading                             | —             | —             | MEMBER+     |
| Manage members / invites, delete household | OWNER         | —             | —           |
| Redeem invite                              | authenticated | —             | —           |

Cross-service rule: only the household service evaluates roles. Meter and
reading services consume the access verdict; they never query membership data
directly.

## 8. Error semantics

- Not a member of the referenced household → `403` `HOUSEHOLD_ACCESS_DENIED`
  (same on meter/reading paths — do not reveal whether the household exists).
- Authenticated but wrong role for a write → `403` `FORBIDDEN_ROLE`.
- Invalid/expired/used invite code → `404` `INVITE_NOT_FOUND` / `410`
  `INVITE_EXPIRED` / `409` `INVITE_ALREADY_USED`.
- Removing the owner → `409` `OWNER_CANNOT_BE_REMOVED`.

## 9. Security & privacy

- Invite codes are high-entropy, stored hashed, single-use, expiring.
- The internal access endpoint leaks at most "this user has role X in
  household Y" to services on the internal network — acceptable under the A1
  trust model, revisited when A1 lands (it becomes an authenticated internal
  call like the revocation feed).
- Membership enumeration impossible: member lists require membership.

## 10. Acceptance criteria ("done when")

- Owner can invite, member can accept via code, owner can remove.
- `VIEWER` cannot create meters or submit readings anywhere in the system
  (verified end to end through the gateway).
- A non-member cannot see or touch a household, its meters, or its readings
  through any service.
- Single-owner households behave exactly as before (journey test still green).
- Backlog A3 moved to Resolved; contract updated, clients regenerated.

## 11. Resolved decisions

- **Invite redemption UX:** inline dialog on the households list ("Join
  household" → paste code). No dedicated page; no delivery channel exists, so
  users always start inside the app. Chosen by implementation effort (2026-09-27).
- **Who can invite:** owner-only this phase. Matches "owner controls
  membership"; revisit if household use shows friction.
- **Reading-service access-check placement:** per-request service call at the
  top of each command/query handler, mirroring the existing
  `MeterService` pattern — no guard/decorator indirection.
