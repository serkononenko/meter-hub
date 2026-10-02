# MeterHub — API Usage Examples

A walkthrough of the MVP flow with real requests. Everything goes through
the API gateway; `<service>` path segments are literal service names, not
placeholders. Run the stack first (`docker compose up -d --build`), then:

```bash
GATEWAY=http://localhost:8080
```

Conventions used by every endpoint (full rules: docs/api-conventions.md):

- Success bodies and errors are JSON; errors are
  `application/problem+json` (RFC 9457) with a stable machine-readable
  `code` field — match on `code`, not `detail`.
- Every response echoes `X-Correlation-ID`; sending your own UUID makes a
  request traceable across all services' logs.
- All endpoints except `register`/`login`/`refresh`/`logout` require
  `Authorization: Bearer <accessToken>`.

## 1. Register

```bash
curl -sS -X POST "$GATEWAY/api/identity-service/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","username":"jane.doe","password":"correct-horse-battery"}'
```

`201 Created`:

```json
{
  "id": "9f1d3a5e-7c4b-4d1e-9a2f-3b8c5d6e7f10",
  "email": "jane@example.com",
  "username": "jane.doe",
  "status": "ACTIVE"
}
```

Re-registering the same email → `409 Conflict`:

```json
{
  "type": "https://api.meterhub.local/problems/email-already-exists",
  "title": "Email already registered",
  "status": 409,
  "code": "EMAIL_ALREADY_EXISTS",
  "correlationId": "7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10"
}
```

## 2. Log in

```bash
curl -sS -X POST "$GATEWAY/api/identity-service/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"correct-horse-battery"}'
```

`200 OK`:

```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiJ9...",
  "refreshToken": "b1c2d3e4-...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": { "id": "9f1d3a5e-...", "email": "jane@example.com", "username": "jane.doe" }
}
```

Access tokens live 15 minutes; refresh tokens 30 days. Wrong password and
unknown email return the identical `401` with `"code":"INVALID_CREDENTIALS"`
(no user enumeration).

Use the access token everywhere below:

```bash
TOKEN="<accessToken>"
```

Who am I:

```bash
curl -sS "$GATEWAY/api/identity-service/api/v1/users/me" -H "Authorization: Bearer $TOKEN"
```

## 3. Create a household

```bash
curl -sS -X POST "$GATEWAY/api/household-service/api/v1/households" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Home"}'
```

`201 Created`:

```json
{ "id": "3c9b7f20-...", "name": "Home", "createdAt": "2026-09-19T18:00:00Z" }
```

List your households: `GET /api/household-service/api/v1/households`
(returns an array). Fetch one:
`GET /api/household-service/api/v1/households/{householdId}`.

## 4. Add a meter

```bash
curl -sS -X POST "$GATEWAY/api/meter-service/api/v1/meters" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "householdId": "3c9b7f20-...",
    "type": "ELECTRICITY",
    "name": "Main electricity meter",
    "serialNumber": "EL-123456",
    "unit": "KWH"
  }'
```

`201 Created`:

```json
{
  "id": "a5e4d3c2-...",
  "householdId": "3c9b7f20-...",
  "type": "ELECTRICITY",
  "name": "Main electricity meter",
  "serialNumber": "EL-123456",
  "unit": "KWH",
  "status": "ACTIVE"
}
```

The caller must be a member of the household; otherwise the household
ownership check fails and the request is rejected. The same serial number
twice in one household → `409` with `"code":"METER_SERIAL_NUMBER_CONFLICT"`.

List meters of a household:
`GET /api/meter-service/api/v1/meters?householdId={householdId}`.

## 5. Record a reading

```bash
curl -sS -X POST "$GATEWAY/api/reading-service/api/v1/readings" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "meterId": "a5e4d3c2-...",
    "value": 1050.5,
    "recordedAt": "2026-09-19T16:00:00Z"
  }'
```

`201 Created`:

```json
{
  "id": "7e6f5a4b-...",
  "meterId": "a5e4d3c2-...",
  "value": 1050.5,
  "recordedAt": "2026-09-19T16:00:00Z",
  "source": "MANUAL",
  "createdAt": "2026-09-19T18:05:12Z"
}
```

Rules enforced by Reading Service:

- `recordedAt` must be an ISO-8601 UTC timestamp (api-conventions §3).
- A reading may not be lower than the newest existing one for the meter —
  a decreasing value → `422` with `"code":"READING_DECREASING"`.

## 6. View reading history and latest value

```bash
curl -sS "$GATEWAY/api/reading-service/api/v1/meters/{meterId}/readings?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

`200 OK` — array, **newest first**:

```json
[
  { "id": "7e6f5a4b-...", "value": 1050.5, "...": "..." },
  { "id": "6d5c4b3a-...", "value": 1000,    "...": "..." }
]
```

Just the latest value:

```bash
curl -sS "$GATEWAY/api/reading-service/api/v1/meters/{meterId}/readings/latest" \
  -H "Authorization: Bearer $TOKEN"
```

## 7. Refresh, rotate, log out

```bash
# Refresh: rotates the refresh token — the old one is consumed
curl -sS -X POST "$GATEWAY/api/identity-service/api/v1/auth/refresh" \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"b1c2d3e4-..."}'
```

`200 OK` returns a new `accessToken` **and a new `refreshToken`**.
Reusing the already-consumed refresh token → `401`
`"code":"INVALID_REFRESH_TOKEN"` (rotation detection — treat as a session
compromise signal and log in again).

```bash
# Log out: revokes the given refresh token
curl -sS -X POST "$GATEWAY/api/identity-service/api/v1/auth/logout" \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<new refreshToken>"}'   # 204 No Content
```

## 8. Household roles and invites

Households have three roles. The creator is `OWNER`; everyone else joins
through an invitation the owner created:

| Role | Read household/meters/readings | Add meters, record readings | Manage members & invites |
|---|---|---|---|
| OWNER | ✓ | ✓ | ✓ |
| MEMBER | ✓ | ✓ | — |
| VIEWER | ✓ | — (`403 FORBIDDEN_ROLE`) | — |

```bash
# Owner: create an invitation (one-time code, shown only in this response)
curl -sS -X POST "$GATEWAY/api/household-service/api/v1/households/{householdId}/invites" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"role":"MEMBER"}'
```

`201 Created` — the `code` is returned in plaintext exactly once (stored
hashed, expires in 7 days):

```json
{ "id": "4d5e6f7a-...", "role": "MEMBER", "code": "mh_i9dK2pQ7...", "expiresAt": "2026-10-04T10:00:00Z" }
```

```bash
# Invitee: redeem the code — joins with the invite's role
curl -sS -X POST "$GATEWAY/api/household-service/api/v1/households/invites/redeem" \
  -H "Authorization: Bearer $INVITEE_TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"mh_i9dK2pQ7..."}'
```

`200 OK` → `{ "householdId": "...", "householdName": "Home", "role": "MEMBER" }`.

Household responses now carry *your* role in the household:
`GET /api/household-service/api/v1/households` returns every household you
have any membership in, each with `"role"`.

Error paths on redeem: unknown code → `404 INVITE_NOT_FOUND`, already
used → `409 INVITE_ALREADY_USED`, expired → `410 INVITE_EXPIRED`, revoked
→ `404`. Owner-only management returns `403 HOUSEHOLD_ACCESS_DENIED` for
members/viewers; removing the owner (even self-removal) is
`409 OWNER_CANNOT_BE_REMOVED`.

After the owner removes a member, the member's writes can linger up to
~30 seconds (services cache role verdicts), then every household, meter
and reading of that household is `404`-masked for them again.

## 9. User isolation

Data is isolated per user end to end: a second user's token gets `404` (not
`403`) for the first user's household, meter and readings — the resources
simply do not exist from their point of view. The e2e journey test
(`node --test e2e/journey.e2e.test.mjs`) asserts all of the above
continuously.

## 10. Typical errors

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | request body fails field validation (`errors[]` names the fields) |
| 401 | `UNAUTHORIZED` | no `Authorization` header on a protected route |
| 401 | `INVALID_TOKEN` | expired/garbage/wrongly signed access token |
| 401 | `INVALID_CREDENTIALS` | login with wrong password or unknown email |
| 401 | `INVALID_REFRESH_TOKEN` | unknown, consumed or revoked refresh token |
| 403 | `HOUSEHOLD_ACCESS_DENIED` | authenticated, but not the owner of the household (member management, invites) |
| 403 | `FORBIDDEN_ROLE` | VIEWER attempting a meter or reading write |
| 404 | `METER_NOT_FOUND` / `HOUSEHOLD_NOT_FOUND` / `READING_NOT_FOUND` | unknown, other user's resource, or a household you have no membership in |
| 404 | `INVITE_NOT_FOUND` | unknown or revoked invitation code |
| 409 | `EMAIL_ALREADY_EXISTS` / `USERNAME_ALREADY_EXISTS` | duplicate registration |
| 409 | `METER_SERIAL_NUMBER_CONFLICT` | duplicate serial in the same household |
| 409 | `INVITE_ALREADY_USED` | invitation code redeemed a second time |
| 409 | `OWNER_CANNOT_BE_REMOVED` | removing the household owner (including self-removal) |
| 410 | `INVITE_EXPIRED` | invitation code past its 7-day expiry |
| 422 | `READING_DECREASING` | reading lower than the newest one |
| 503 | `HOUSEHOLD_SERVICE_UNAVAILABLE` | meter/reading ownership check could not reach the household service (fail closed) |

Every error body carries `correlationId`; include it (or send your own
`X-Correlation-ID` header) when grepping `docker compose logs` for a failure.
