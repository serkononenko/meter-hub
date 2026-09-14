
# Household


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Household } from ''

// TODO: Update the object below with actual values
const example = {
  "id": 3f9c1a2e-8d4b-4a1f-9e2c-5b7d6a8e1c30,
  "name": null,
  "createdAt": 2026-08-27T08:30Z,
  "updatedAt": 2026-08-27T08:30Z,
} satisfies Household

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Household
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


