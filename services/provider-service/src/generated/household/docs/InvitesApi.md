# InvitesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createHouseholdInvite**](InvitesApi.md#createhouseholdinvite) | **POST** /api/v1/households/{householdId}/invites | Create an invitation for a household |
| [**listHouseholdInvites**](InvitesApi.md#listhouseholdinvites) | **GET** /api/v1/households/{householdId}/invites | List live invitations for a household |
| [**redeemHouseholdInvite**](InvitesApi.md#redeemhouseholdinvite) | **POST** /api/v1/households/invites/redeem | Redeem an invitation code |
| [**revokeHouseholdInvite**](InvitesApi.md#revokehouseholdinvite) | **DELETE** /api/v1/households/{householdId}/invites/{inviteId} | Revoke a live invitation |



## createHouseholdInvite

> InviteCreated createHouseholdInvite(householdId, createInviteRequest, xCorrelationID)

Create an invitation for a household

Owner-only. Creates a single-use invitation with an opaque code for the target role. The code is returned in plaintext exactly once, in this response — it is stored only as a hash. A bounded number of live (unredeemed, unexpired) invites per household is enforced.

### Example

```ts
import {
  Configuration,
  InvitesApi,
} from '';
import type { CreateHouseholdInviteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new InvitesApi(config);

  const body = {
    // string | Identifier of the household.
    householdId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // CreateInviteRequest
    createInviteRequest: {"role":"MEMBER"},
    // string | Identifier used to trace a request across MeterHub services. (optional)
    xCorrelationID: 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  } satisfies CreateHouseholdInviteRequest;

  try {
    const data = await api.createHouseholdInvite(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **householdId** | `string` | Identifier of the household. | [Defaults to `undefined`] |
| **createInviteRequest** | [CreateInviteRequest](CreateInviteRequest.md) |  | |
| **xCorrelationID** | `string` | Identifier used to trace a request across MeterHub services. | [Optional] [Defaults to `undefined`] |

### Return type

[**InviteCreated**](InviteCreated.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Invitation created. The code is shown only here. |  * X-Correlation-ID -  <br>  |
| **400** | Invalid request or validation error. |  -  |
| **401** | No access token supplied, or it is invalid or expired. |  * X-Correlation-ID -  <br>  |
| **403** | The authenticated user has no membership in the referenced household (existence is not revealed). |  * X-Correlation-ID -  <br>  |
| **409** | Live-invite limit reached for this household. |  * X-Correlation-ID -  <br>  |
| **500** | Unexpected server-side error. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listHouseholdInvites

> Array&lt;Invite&gt; listHouseholdInvites(householdId, xCorrelationID)

List live invitations for a household

Owner-only. Returns live (unredeemed, unexpired, not revoked) invitations. Code material is never included.

### Example

```ts
import {
  Configuration,
  InvitesApi,
} from '';
import type { ListHouseholdInvitesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new InvitesApi(config);

  const body = {
    // string | Identifier of the household.
    householdId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string | Identifier used to trace a request across MeterHub services. (optional)
    xCorrelationID: 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  } satisfies ListHouseholdInvitesRequest;

  try {
    const data = await api.listHouseholdInvites(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **householdId** | `string` | Identifier of the household. | [Defaults to `undefined`] |
| **xCorrelationID** | `string` | Identifier used to trace a request across MeterHub services. | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;Invite&gt;**](Invite.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Live invitations. |  * X-Correlation-ID -  <br>  |
| **401** | No access token supplied, or it is invalid or expired. |  * X-Correlation-ID -  <br>  |
| **403** | The authenticated user has no membership in the referenced household (existence is not revealed). |  * X-Correlation-ID -  <br>  |
| **500** | Unexpected server-side error. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## redeemHouseholdInvite

> RedeemInviteResponse redeemHouseholdInvite(redeemInviteRequest, xCorrelationID)

Redeem an invitation code

Any authenticated user can redeem a valid code. A membership with the invite\&#39;s role is created for the caller. Redeeming is idempotent for an existing member (returns the household, no duplicate membership). Single-use: a redeemed code fails afterwards. Codes are not extended.

### Example

```ts
import {
  Configuration,
  InvitesApi,
} from '';
import type { RedeemHouseholdInviteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new InvitesApi(config);

  const body = {
    // RedeemInviteRequest
    redeemInviteRequest: {"code":"mh_i9dK2pQ7vX4mZ8wR1tY6uJ3nB5cA0eS"},
    // string | Identifier used to trace a request across MeterHub services. (optional)
    xCorrelationID: 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  } satisfies RedeemHouseholdInviteRequest;

  try {
    const data = await api.redeemHouseholdInvite(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **redeemInviteRequest** | [RedeemInviteRequest](RedeemInviteRequest.md) |  | |
| **xCorrelationID** | `string` | Identifier used to trace a request across MeterHub services. | [Optional] [Defaults to `undefined`] |

### Return type

[**RedeemInviteResponse**](RedeemInviteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Membership granted (or already present), with the household reference. |  * X-Correlation-ID -  <br>  |
| **400** | Invalid request or validation error. |  -  |
| **401** | No access token supplied, or it is invalid or expired. |  * X-Correlation-ID -  <br>  |
| **404** | No invitation matches the supplied code. |  * X-Correlation-ID -  <br>  |
| **409** | The invitation has already been redeemed. |  * X-Correlation-ID -  <br>  |
| **410** | The invitation has expired. |  * X-Correlation-ID -  <br>  |
| **500** | Unexpected server-side error. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## revokeHouseholdInvite

> revokeHouseholdInvite(householdId, inviteId, xCorrelationID)

Revoke a live invitation

Owner-only. Revokes a live invitation; redeeming it afterwards fails.

### Example

```ts
import {
  Configuration,
  InvitesApi,
} from '';
import type { RevokeHouseholdInviteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new InvitesApi(config);

  const body = {
    // string | Identifier of the household.
    householdId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string | Identifier of the invitation.
    inviteId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string | Identifier used to trace a request across MeterHub services. (optional)
    xCorrelationID: 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  } satisfies RevokeHouseholdInviteRequest;

  try {
    const data = await api.revokeHouseholdInvite(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **householdId** | `string` | Identifier of the household. | [Defaults to `undefined`] |
| **inviteId** | `string` | Identifier of the invitation. | [Defaults to `undefined`] |
| **xCorrelationID** | `string` | Identifier used to trace a request across MeterHub services. | [Optional] [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | Invitation revoked. |  * X-Correlation-ID -  <br>  |
| **401** | No access token supplied, or it is invalid or expired. |  * X-Correlation-ID -  <br>  |
| **403** | The authenticated user has no membership in the referenced household (existence is not revealed). |  * X-Correlation-ID -  <br>  |
| **404** | No live invitation with this identifier in this household. |  * X-Correlation-ID -  <br>  |
| **500** | Unexpected server-side error. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

