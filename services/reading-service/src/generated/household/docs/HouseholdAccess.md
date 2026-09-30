
# HouseholdAccess

Caller-independent access verdict for a user/household pair.

## Properties

Name | Type
------------ | -------------
`_exists` | boolean
`role` | [HouseholdRole](HouseholdRole.md)

## Example

```typescript
import type { HouseholdAccess } from ''

// TODO: Update the object below with actual values
const example = {
  "_exists": null,
  "role": null,
} satisfies HouseholdAccess

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as HouseholdAccess
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


