
# HouseholdRole

Membership role inside a household. * `OWNER` — everything MEMBER can do, plus manage members/invites and delete the household. Exactly one per household (the creator); immutable. * `MEMBER` — view everything; create/modify meters; submit readings. * `VIEWER` — read-only: view household, meters, and readings. 

## Properties

Name | Type
------------ | -------------

## Example

```typescript
import type { HouseholdRole } from ''

// TODO: Update the object below with actual values
const example = {
} satisfies HouseholdRole

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as HouseholdRole
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


