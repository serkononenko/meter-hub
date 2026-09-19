
# Meter


## Properties

Name | Type
------------ | -------------
`id` | string
`householdId` | string
`type` | [MeterType](MeterType.md)
`name` | string
`serialNumber` | string
`unit` | [MeterUnit](MeterUnit.md)
`status` | [MeterStatus](MeterStatus.md)
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Meter } from ''

// TODO: Update the object below with actual values
const example = {
  "id": 0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01,
  "householdId": null,
  "type": null,
  "name": null,
  "serialNumber": null,
  "unit": null,
  "status": null,
  "createdAt": 2026-08-27T08:30Z,
  "updatedAt": 2026-08-27T08:30Z,
} satisfies Meter

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Meter
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


