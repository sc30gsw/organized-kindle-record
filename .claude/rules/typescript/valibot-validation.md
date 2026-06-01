---
description: Valibot schemas — placement under features/*/schemas/, InferOutput, TanStack Form native Standard Schema
globs: ["src/features/**/schemas/*.ts", "src/features/**/components/*-form.tsx"]
alwaysApply: true
---

# Valibot Validation

## Placement: `features/*/schemas/`

Each feature owns its schemas. Place them in `features/[feature]/schemas/[name].ts`:

```
src/features/products/schemas/
├── create-product-schema.ts    # form schema for creation
└── product-schema.ts           # data validation schema
```

## Derive types with `InferOutput`

Align form/schema types with generated API types by deriving from schemas:

```typescript
import * as v from "valibot";

export const CreateProductSchema = v.object({
  description: v.optional(v.string()),
  name: v.pipe(v.string(), v.minLength(1, "名前は必須です")),
  price: v.pipe(v.number(), v.minValue(0, "価格は0以上で入力してください")),
});

export type CreateProductInput = v.InferOutput<typeof CreateProductSchema>;
```

When the generated `types.gen.ts` already defines a matching type, use `Pick` to align:

```typescript
// Prefer picking from generated type to stay in sync with the API contract
export type CreateProductInput = Pick<Product, "description" | "name" | "price">;
```

## TanStack Form (v1 — native Standard Schema, no adapter)

TanStack Form v1 natively supports the Standard Schema spec (Valibot 1.0+, Zod, ArkType). Pass the Valibot schema **directly** to `validators` — there is no `validatorAdapter`, and `@tanstack/valibot-adapter` / `valibotValidator()` must NOT be reintroduced for forms (pre-v1 pattern):

> **Forms only.** TanStack **Router** `validateSearch` is the opposite: it REQUIRES `valibotValidator()` from `@tanstack/valibot-adapter` (for input/output type separation and default coercion of search params). Do not "simplify" route `validateSearch` to a bare schema — keep the adapter there.

```typescript
import { useForm } from '@tanstack/react-form'
import { CreateProductSchema } from '~/features/products/schemas/create-product-schema'

export function ProductForm({ onSuccess }: Record<'onSuccess', () => void>) {
  const form = useForm({
    defaultValues: { description: '', name: '', price: 0 },
    onSubmit: async ({ value }) => { ... },
    validators: {
      onChange: CreateProductSchema,
    },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      <form.Field name="name">
        {(field) => (
          <>
            <TextInput
              error={field.state.meta.errors[0]}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              value={field.state.value}
            />
          </>
        )}
      </form.Field>
    </form>
  )
}
```

## Boundaries only

Validate at system boundaries (user input, API responses). Do NOT add Valibot validation to pure internal data transformations.

## Related rules

- [common/security.md](../common/security.md) — why boundary validation matters
