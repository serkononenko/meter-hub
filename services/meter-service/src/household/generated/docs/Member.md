
# Member


## Properties

Name | Type
------------ | -------------
`id` | string
`userId` | string
`role` | [HouseholdRole](HouseholdRole.md)
`createdAt` | Date

## Example

```typescript
import type { Member } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "userId": null,
  "role": null,
  "createdAt": 2026-08-27T08:30Z,
} satisfies Member

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Member
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


