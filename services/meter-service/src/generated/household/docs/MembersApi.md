# MembersApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listHouseholdMembers**](MembersApi.md#listhouseholdmembers) | **GET** /api/v1/households/{householdId}/members | List members of a household |
| [**removeHouseholdMember**](MembersApi.md#removehouseholdmember) | **DELETE** /api/v1/households/{householdId}/members/{userId} | Remove a member from a household |



## listHouseholdMembers

> Array&lt;Member&gt; listHouseholdMembers(householdId, xCorrelationID)

List members of a household

Returns all members of the household with their roles. Requires any membership; callers without membership in the referenced household get 403 regardless of whether the household exists (no enumeration).

### Example

```ts
import {
  Configuration,
  MembersApi,
} from '';
import type { ListHouseholdMembersRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MembersApi(config);

  const body = {
    // string | Identifier of the household.
    householdId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string | Identifier used to trace a request across MeterHub services. (optional)
    xCorrelationID: 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  } satisfies ListHouseholdMembersRequest;

  try {
    const data = await api.listHouseholdMembers(body);
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

[**Array&lt;Member&gt;**](Member.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Member list. |  * X-Correlation-ID -  <br>  |
| **401** | No access token supplied, or it is invalid or expired. |  * X-Correlation-ID -  <br>  |
| **403** | The authenticated user has no membership in the referenced household (existence is not revealed). |  * X-Correlation-ID -  <br>  |
| **500** | Unexpected server-side error. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## removeHouseholdMember

> removeHouseholdMember(householdId, userId, xCorrelationID)

Remove a member from a household

Owner-only. Removes the member\&#39;s membership. Removing the owner (including the owner removing themselves) is rejected — ownership never changes or gets removed via this endpoint.

### Example

```ts
import {
  Configuration,
  MembersApi,
} from '';
import type { RemoveHouseholdMemberRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MembersApi(config);

  const body = {
    // string | Identifier of the household.
    householdId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string | Identifier of the user whose membership is removed.
    userId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string | Identifier used to trace a request across MeterHub services. (optional)
    xCorrelationID: 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  } satisfies RemoveHouseholdMemberRequest;

  try {
    const data = await api.removeHouseholdMember(body);
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
| **userId** | `string` | Identifier of the user whose membership is removed. | [Defaults to `undefined`] |
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
| **204** | Membership removed. |  * X-Correlation-ID -  <br>  |
| **401** | No access token supplied, or it is invalid or expired. |  * X-Correlation-ID -  <br>  |
| **403** | The authenticated user has no membership in the referenced household (existence is not revealed). |  * X-Correlation-ID -  <br>  |
| **404** | The referenced user has no membership in this household. |  * X-Correlation-ID -  <br>  |
| **409** | The referenced member is the household owner. |  * X-Correlation-ID -  <br>  |
| **500** | Unexpected server-side error. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

