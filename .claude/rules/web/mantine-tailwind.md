---
description: Mantine 9 + Tailwind v4 coexistence — default to Mantine, Tailwind for layout shells, theme tokens
globs: ["app/src/**/*.tsx"]
alwaysApply: true
---

# Mantine + Tailwind Coexistence

## Default: Mantine first

Use Mantine components and props before reaching for Tailwind utilities.

```tsx
// CORRECT: Mantine spacing/color props
<Button color="blue" mt="md" size="sm">
  送信
</Button>

// WRONG: Tailwind overriding Mantine props that already exist
<Button className="mt-4 text-blue-600 text-sm">
  送信
</Button>
```

## Where Tailwind belongs

Tailwind is for **layout on plain wrapper elements** — the `div`s that Mantine does not own.
Do NOT use Tailwind to override Mantine component internals via arbitrary selectors.

```tsx
// CORRECT: Tailwind for the layout shell, Mantine for the components inside
// app/src/routes/_authenticated.tsx
<div className="flex h-dvh flex-col">
  <AppHeader email={user.email} />
  <div className="min-h-0 flex-1">
    <Outlet />
  </div>
</div>;

// WRONG: fighting Mantine internals with Tailwind
<Button className="[&_.mantine-Button-label]:text-red-500">...</Button>;
```

A Mantine component may still take a `className` when the utility expresses something Mantine has
no prop for — `cursor-pointer`, `absolute`, `table-fixed`, `overflow-auto`. Anything Mantine *does*
have a prop for (`bg`, `c`, `w`, `h`, `p`, `m`, `display`, `truncate`) goes through the prop.

```tsx
// CORRECT: 色/幅は Mantine prop、prop の無いものだけ Tailwind
<Table.Th bg="blue.0" c="blue.9" w={header.getSize()} className="cursor-pointer">
```

## No `cn()` helper in this repo

There is no `cn()` / `clsx` / `tailwind-merge` utility installed, and no `tailwind-preset-mantine`.
Compose classes with a plain template string, or add one of those deliberately (and update this
rule) before relying on it. Do not import `~/lib/utils` — it does not exist, and `~/` here resolves
to the root CLI `src/`, not to app code (see `typescript/project-structure.md`).

## Theme tokens

Prefer Mantine theme tokens over hardcoded values.

```tsx
// CORRECT: Mantine のスケールを参照する
<Box bg="blue.6" c="white">
<Table.Tr bg="gray.0">

// 許容: Mantine prop の無い箇所で CSS 変数を使う
<Box style={{ borderLeft: "3px solid var(--mantine-color-blue-4)" }}>

// WRONG: デザインシステムを迂回するハードコード
<div style={{ backgroundColor: "#228BE6" }}>
```

Access theme values in code via `useMantineTheme()` or `rem()`:

```tsx
import { rem, useMantineTheme } from "@mantine/core";

const theme = useMantineTheme();
const primaryColor = theme.colors[theme.primaryColor][6];
const spacing = rem(16);
```

## Heights

Do not hardcode viewport heights (`70vh`, `calc(100vh - 16px)`). The authenticated layout is a
`h-dvh` flex column, so pages use `h-full` + `min-h-0 flex-1` and only the intended scroll region
scrolls.

## Related skills

- `mantine-custom-components` — building Mantine-based components
- `frontend-design` — design patterns for this admin UI
