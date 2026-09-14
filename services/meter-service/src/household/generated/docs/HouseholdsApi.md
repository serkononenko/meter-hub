# HouseholdsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createHousehold**](HouseholdsApi.md#createhouseholdoperation) | **POST** /api/v1/households | Create a household owned by the authenticated user |
| [**getHousehold**](HouseholdsApi.md#gethousehold) | **GET** /api/v1/households/{householdId} | Return a single household |
| [**listHouseholds**](HouseholdsApi.md#listhouseholds) | **GET** /api/v1/households | List households owned by the authenticated user |



## createHousehold

> Household createHousehold(createHouseholdRequest, xCorrelationID)

Create a household owned by the authenticated user

Creates a household with the authenticated user as its owner. The caller\&#39;s identity is taken from the presented access token.

### Example

```ts
import {
  Configuration,
  HouseholdsApi,
} from '';
import type { CreateHouseholdOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HouseholdsApi(config);

  const body = {
    // CreateHouseholdRequest
    createHouseholdRequest: {"name":"Home"},
    // string | Identifier used to trace a request across MeterHub services. (optional)
    xCorrelationID: 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  } satisfies CreateHouseholdOperationRequest;

  try {
    const data = await api.createHousehold(body);
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
| **createHouseholdRequest** | [CreateHouseholdRequest](CreateHouseholdRequest.md) |  | |
| **xCorrelationID** | `string` | Identifier used to trace a request across MeterHub services. | [Optional] [Defaults to `undefined`] |

### Return type

[**Household**](Household.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Household created. |  * X-Correlation-ID -  <br>  |
| **400** | Invalid request or validation error. |  -  |
| **401** | No access token was supplied, or it is invalid or expired. |  * X-Correlation-ID -  <br>  |
| **500** | Unexpected server-side error. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getHousehold

> Household getHousehold(householdId, xCorrelationID)

Return a single household

Returns the household with the given identifier when it is owned by the authenticated user. Households of other users are not visible.

### Example

```ts
import {
  Configuration,
  HouseholdsApi,
} from '';
import type { GetHouseholdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HouseholdsApi(config);

  const body = {
    // string | Identifier of the household to return.
    householdId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string | Identifier used to trace a request across MeterHub services. (optional)
    xCorrelationID: 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  } satisfies GetHouseholdRequest;

  try {
    const data = await api.getHousehold(body);
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
| **householdId** | `string` | Identifier of the household to return. | [Defaults to `undefined`] |
| **xCorrelationID** | `string` | Identifier used to trace a request across MeterHub services. | [Optional] [Defaults to `undefined`] |

### Return type

[**Household**](Household.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The household. |  * X-Correlation-ID -  <br>  |
| **401** | No access token was supplied, or it is invalid or expired. |  * X-Correlation-ID -  <br>  |
| **404** | No household with this identifier is visible to the authenticated user. |  * X-Correlation-ID -  <br>  |
| **500** | Unexpected server-side error. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listHouseholds

> Array&lt;Household&gt; listHouseholds(xCorrelationID)

List households owned by the authenticated user

Returns the households of the user that owns the presented access token, most recently created first.

### Example

```ts
import {
  Configuration,
  HouseholdsApi,
} from '';
import type { ListHouseholdsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new HouseholdsApi(config);

  const body = {
    // string | Identifier used to trace a request across MeterHub services. (optional)
    xCorrelationID: 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  } satisfies ListHouseholdsRequest;

  try {
    const data = await api.listHouseholds(body);
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
| **xCorrelationID** | `string` | Identifier used to trace a request across MeterHub services. | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;Household&gt;**](Household.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The authenticated user\&#39;s households. |  * X-Correlation-ID -  <br>  |
| **401** | No access token was supplied, or it is invalid or expired. |  * X-Correlation-ID -  <br>  |
| **500** | Unexpected server-side error. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

