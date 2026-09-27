
# CreateMeterRequest


## Properties

Name | Type
------------ | -------------
`householdId` | string
`type` | [MeterType](MeterType.md)
`name` | string
`serialNumber` | string
`unit` | [MeterUnit](MeterUnit.md)

## Example

```typescript
import type { CreateMeterRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "householdId": null,
  "type": null,
  "name": null,
  "serialNumber": null,
  "unit": null,
} satisfies CreateMeterRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateMeterRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


