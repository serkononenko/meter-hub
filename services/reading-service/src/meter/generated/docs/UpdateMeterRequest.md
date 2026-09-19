
# UpdateMeterRequest


## Properties

Name | Type
------------ | -------------
`name` | string
`serialNumber` | string
`unit` | [MeterUnit](MeterUnit.md)
`status` | [MeterStatus](MeterStatus.md)

## Example

```typescript
import type { UpdateMeterRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "serialNumber": null,
  "unit": null,
  "status": null,
} satisfies UpdateMeterRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateMeterRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


