
# InviteCreated

A newly created invitation. The code appears in plaintext exactly once — here.

## Properties

Name | Type
------------ | -------------
`id` | string
`role` | [HouseholdRole](HouseholdRole.md)
`code` | string
`createdAt` | Date
`expiresAt` | Date

## Example

```typescript
import type { InviteCreated } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "role": null,
  "code": null,
  "createdAt": 2026-09-27T10:00Z,
  "expiresAt": 2026-10-04T10:00Z,
} satisfies InviteCreated

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as InviteCreated
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


