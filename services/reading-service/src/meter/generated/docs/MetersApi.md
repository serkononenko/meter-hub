# MetersApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createMeter**](MetersApi.md#createmeteroperation) | **POST** /api/v1/meters | Register a meter in a household owned by the authenticated user |
| [**getMeter**](MetersApi.md#getmeter) | **GET** /api/v1/meters/{meterId} | Return a single meter |
| [**listMeters**](MetersApi.md#listmeters) | **GET** /api/v1/meters | List meters of a household owned by the authenticated user |
| [**updateMeter**](MetersApi.md#updatemeteroperation) | **PATCH** /api/v1/meters/{meterId} | Update mutable fields of a meter |



## createMeter

> Meter createMeter(createMeterRequest, xCorrelationID)

Register a meter in a household owned by the authenticated user

Creates a meter under the given household. The household must exist and be owned by the user that owns the presented access token; households of other users are not addressable and return the same not-found problem as unknown ones.

### Example

```ts
import {
  Configuration,
  MetersApi,
} from '';
import type { CreateMeterOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MetersApi(config);

  const body = {
    // CreateMeterRequest
    createMeterRequest: {"householdId":"3f9c1a2e-8d4b-4a1f-9e2c-5b7d6a8e1c30","type":"ELECTRICITY","name":"Main electricity meter","serialNumber":"EL-123456","unit":"KWH"},
    // string | Identifier used to trace a request across MeterHub services. (optional)
    xCorrelationID: 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  } satisfies CreateMeterOperationRequest;

  try {
    const data = await api.createMeter(body);
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
| **createMeterRequest** | [CreateMeterRequest](CreateMeterRequest.md) |  | |
| **xCorrelationID** | `string` | Identifier used to trace a request across MeterHub services. | [Optional] [Defaults to `undefined`] |

### Return type

[**Meter**](Meter.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Meter created. |  * X-Correlation-ID -  <br>  |
| **400** | Invalid request or validation error. |  -  |
| **401** | No access token was supplied, or it is invalid or expired. |  * X-Correlation-ID -  <br>  |
| **404** | No household with this identifier is visible to the authenticated user. |  * X-Correlation-ID -  <br>  |
| **409** | A meter with the same serial number is already registered in this household. |  * X-Correlation-ID -  <br>  |
| **500** | Unexpected server-side error. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getMeter

> Meter getMeter(meterId, xCorrelationID)

Return a single meter

Returns the meter with the given identifier when its household is owned by the authenticated user. Meters of other users are not visible.

### Example

```ts
import {
  Configuration,
  MetersApi,
} from '';
import type { GetMeterRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MetersApi(config);

  const body = {
    // string | Identifier of the meter to return.
    meterId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string | Identifier used to trace a request across MeterHub services. (optional)
    xCorrelationID: 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  } satisfies GetMeterRequest;

  try {
    const data = await api.getMeter(body);
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
| **meterId** | `string` | Identifier of the meter to return. | [Defaults to `undefined`] |
| **xCorrelationID** | `string` | Identifier used to trace a request across MeterHub services. | [Optional] [Defaults to `undefined`] |

### Return type

[**Meter**](Meter.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The meter. |  * X-Correlation-ID -  <br>  |
| **401** | No access token was supplied, or it is invalid or expired. |  * X-Correlation-ID -  <br>  |
| **404** | No meter with this identifier is visible to the authenticated user. |  * X-Correlation-ID -  <br>  |
| **500** | Unexpected server-side error. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listMeters

> Array&lt;Meter&gt; listMeters(householdId, xCorrelationID)

List meters of a household owned by the authenticated user

Returns the meters registered under the given household, oldest first. The household must exist and be owned by the user that owns the presented access token.

### Example

```ts
import {
  Configuration,
  MetersApi,
} from '';
import type { ListMetersRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MetersApi(config);

  const body = {
    // string | Identifier of the household whose meters to return.
    householdId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string | Identifier used to trace a request across MeterHub services. (optional)
    xCorrelationID: 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  } satisfies ListMetersRequest;

  try {
    const data = await api.listMeters(body);
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
| **householdId** | `string` | Identifier of the household whose meters to return. | [Defaults to `undefined`] |
| **xCorrelationID** | `string` | Identifier used to trace a request across MeterHub services. | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;Meter&gt;**](Meter.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The household\&#39;s meters. |  * X-Correlation-ID -  <br>  |
| **400** | Invalid request or validation error. |  -  |
| **401** | No access token was supplied, or it is invalid or expired. |  * X-Correlation-ID -  <br>  |
| **404** | No household with this identifier is visible to the authenticated user. |  * X-Correlation-ID -  <br>  |
| **500** | Unexpected server-side error. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateMeter

> Meter updateMeter(meterId, updateMeterRequest, xCorrelationID)

Update mutable fields of a meter

Partially updates the meter with the given identifier when its household is owned by the authenticated user. Only the provided fields are changed; the household of an existing meter cannot be reassigned.

### Example

```ts
import {
  Configuration,
  MetersApi,
} from '';
import type { UpdateMeterOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MetersApi(config);

  const body = {
    // string | Identifier of the meter to update.
    meterId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateMeterRequest
    updateMeterRequest: {"name":"Renovated electricity meter","status":"ARCHIVED"},
    // string | Identifier used to trace a request across MeterHub services. (optional)
    xCorrelationID: 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  } satisfies UpdateMeterOperationRequest;

  try {
    const data = await api.updateMeter(body);
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
| **meterId** | `string` | Identifier of the meter to update. | [Defaults to `undefined`] |
| **updateMeterRequest** | [UpdateMeterRequest](UpdateMeterRequest.md) |  | |
| **xCorrelationID** | `string` | Identifier used to trace a request across MeterHub services. | [Optional] [Defaults to `undefined`] |

### Return type

[**Meter**](Meter.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The updated meter. |  * X-Correlation-ID -  <br>  |
| **400** | Invalid request or validation error. |  -  |
| **401** | No access token was supplied, or it is invalid or expired. |  * X-Correlation-ID -  <br>  |
| **404** | No meter with this identifier is visible to the authenticated user. |  * X-Correlation-ID -  <br>  |
| **409** | A meter with the same serial number is already registered in this household. |  * X-Correlation-ID -  <br>  |
| **500** | Unexpected server-side error. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

