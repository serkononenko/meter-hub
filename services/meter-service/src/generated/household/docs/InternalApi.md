# InternalApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getHouseholdAccess**](InternalApi.md#gethouseholdaccess) | **GET** /api/v1/internal/household-access | Access verdict for a user/household pair |



## getHouseholdAccess

> HouseholdAccess getHouseholdAccess(householdId, userId, xCorrelationID)

Access verdict for a user/household pair

Returns a caller-independent access verdict for a user/household pair: whether the user has a membership and, if so, its role. Consumers are expected to cache briefly (membership changes are rare; a ~30 s TTL is acceptable). Narrow accessor by design — membership details stay inside the household service. Never proxied by the gateway.

### Example

```ts
import {
  Configuration,
  InternalApi,
} from '';
import type { GetHouseholdAccessRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new InternalApi();

  const body = {
    // string | Identifier of the household.
    householdId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string | Identifier of the user.
    userId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string | Identifier used to trace a request across MeterHub services. (optional)
    xCorrelationID: 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  } satisfies GetHouseholdAccessRequest;

  try {
    const data = await api.getHouseholdAccess(body);
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
| **userId** | `string` | Identifier of the user. | [Defaults to `undefined`] |
| **xCorrelationID** | `string` | Identifier used to trace a request across MeterHub services. | [Optional] [Defaults to `undefined`] |

### Return type

[**HouseholdAccess**](HouseholdAccess.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Access verdict (possibly \&quot;no membership\&quot;). |  * X-Correlation-ID -  <br>  |
| **400** | Invalid request or validation error. |  -  |
| **500** | Unexpected server-side error. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

