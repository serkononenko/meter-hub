
# Problem


## Properties

Name | Type
------------ | -------------
`type` | string
`title` | string
`status` | number
`code` | string
`detail` | string
`correlationId` | string
`instance` | string
`errors` | [Array&lt;ProblemErrorsInner&gt;](ProblemErrorsInner.md)

## Example

```typescript
import type { Problem } from ''

// TODO: Update the object below with actual values
const example = {
  "type": https://api.meterhub.local/problems/validation-error,
  "title": Validation failed,
  "status": 400,
  "code": VALIDATION_ERROR,
  "detail": One or more request fields are invalid.,
  "correlationId": 7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10,
  "instance": /api/v1/meters,
  "errors": null,
} satisfies Problem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Problem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


