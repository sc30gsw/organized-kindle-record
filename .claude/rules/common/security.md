---
description: Secret handling, input validation via Valibot, XSS safety
globs: ["**/*.{ts,tsx}"]
alwaysApply: true
---

# Security

## Secrets

NEVER hardcode secrets, tokens, or credentials in source files.

```typescript
// CORRECT: read from environment at startup
const apiKey = import.meta.env.VITE_API_KEY;
if (!apiKey) throw new Error("VITE_API_KEY is required");

// WRONG: hardcoded secret
const apiKey = "sk-abc123...";
```

- Store secrets in `.env.local` (never commit it)
- Prefix client-side env vars with `VITE_`
- Fail fast on startup if a required variable is missing

## Input validation

ALWAYS validate user input and external API data at system boundaries using Valibot. See [typescript/valibot-validation.md](../typescript/valibot-validation.md) for schema patterns.

```typescript
// CORRECT: validate before use
const result = v.safeParse(ProductSchema, rawInput);
if (!result.success) throw new ValidationError(result.issues);

// WRONG: trusting unvalidated external data
const product = rawApiResponse.data as Product;
```

## XSS

Avoid `dangerouslySetInnerHTML`. If HTML rendering is unavoidable, sanitize the input first with a trusted library.
