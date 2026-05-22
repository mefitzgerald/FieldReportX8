# Theming

## How it works

1. **`ThemeContext.tsx`** wraps the entire app in a `<View>` and uses NativeWind's `vars()` to inject CSS custom properties as a `style` prop. When the user changes theme, the whole variable set is swapped in one operation.

2. **`tailwind.config.js`** maps Tailwind token names to those CSS variables. This is what allows shorthand class names like `bg-background` or `text-text` to resolve to the correct color for the active theme.

3. **Any component** can use the tokens below as `className` props — no knowledge of the active theme required.

## Available Tailwind tokens

### Theme-aware colors

| Class name | Usage example | What it represents |
|---|---|---|
| `bg-background` | `<View className="bg-background">` | Page/screen background |
| `bg-surface` | `<View className="bg-surface">` | Cards, modals, input fields |
| `bg-primary` | `<View className="bg-primary">` | Primary action background |
| `bg-tint` | `<View className="bg-tint">` | Accent / highlight background |
| `bg-danger` | `<View className="bg-danger">` | Destructive action background |
| `bg-border` | `<View className="bg-border">` | Separator / divider lines |
| `text-text` | `<Text className="text-text">` | Primary body text |
| `text-textSecondary` | `<Text className="text-textSecondary">` | Muted / secondary text |
| `text-primary` | `<Text className="text-primary">` | Primary accent text |
| `text-tint` | `<Text className="text-tint">` | Highlighted text |
| `text-danger` | `<Text className="text-danger">` | Error / destructive text |
| `border-border` | `<View className="border border-border">` | Input outlines, card borders |
| `border-danger` | `<View className="border border-danger">` | Error state outlines |
| `border-primary` | `<View className="border border-primary">` | Focused / selected outlines |

### Typography — headings

| Class name | Renders as |
|---|---|
| `text-4xl font-bold text-text` | Hero / logo text |
| `text-3xl font-bold text-text` | Large emoji / icon label |
| `text-2xl font-bold text-text` | Screen heading (h1) |
| `text-xl font-semibold text-text` | Section heading (h2) |
| `text-lg font-semibold text-text` | Sub-section heading (h3) |
| `text-sm font-semibold text-textSecondary uppercase tracking-widest` | Field label / category header |
| `text-sm font-semibold text-textSecondary` | Quiet label |

### Typography — body

| Class name | Renders as |
|---|---|
| `text-base text-text` | Regular body text |
| `text-sm text-text` | Small body / list item |
| `text-xs text-textSecondary` | Caption / status |
| `text-base text-text italic` | Empty state / placeholder |
| `font-mono text-text` | Coordinates, measurements |
| `tracking-wide` | Slightly spaced headers |

### Common reusable patterns

```tsx
// Screen wrapper
<SafeAreaView className="flex-1 bg-background">

// Card / section container
<View className="bg-surface rounded-2xl p-4 gap-3">

// Text input
<TextInput className="border border-border rounded-xl px-4 py-4 text-base text-text bg-surface" />

// Primary button
<Pressable className="bg-primary py-3 rounded-xl items-center active:opacity-80">
  <Text className="text-white font-semibold">Label</Text>
</Pressable>

// Secondary / outline button
<Pressable className="border border-border py-3 rounded-xl items-center active:opacity-60">
  <Text className="text-text font-semibold">Label</Text>
</Pressable>

// Danger button
<Pressable className="bg-danger py-3 rounded-xl items-center active:opacity-80">
  <Text className="text-white font-semibold">Delete</Text>
</Pressable>

// List row
<Pressable className="flex-row items-center justify-between py-4 active:opacity-50">

// Horizontal separator
<View className="h-px bg-border" />

// Field label
<Text className="text-sm font-semibold text-textSecondary uppercase tracking-widest">Label</Text>
```

## Theme colour values

| Token | Light | Dark | Forest | Ocean |
|---|---|---|---|---|
| `background` | `#f8f9fa` | `#1a1a1a` | `#f0f4f0` | `#e8f4f8` |
| `surface` | `#ffffff` | `#2c2c2e` | `#ffffff` | `#ffffff` |
| `primary` | `#007AFF` | `#0A84FF` | `#2d6a4f` | `#0077b6` |
| `text` | `#1a1a1a` | `#ffffff` | `#1b2d1f` | `#03045e` |
| `textSecondary` | `#888888` | `#ababab` | `#6b8c72` | `#4a8fa8` |
| `border` | `#e0e0e0` | `#3a3a3c` | `#c8dfc8` | `#b8d8e8` |
| `danger` | `#FF3B30` | `#FF453A` | `#e63946` | `#e63946` |
| `tint` | `#007AFF` | `#0A84FF` | `#2d6a4f` | `#0077b6` |

## When to use `useTheme()` instead

NativeWind class names are resolved at build time, so they cannot reference a color value that is only known at runtime (e.g. "the tint color of the currently active pill"). In those cases, pull the live hex value from the context:

```tsx
const { colours } = useTheme();

<View style={{ backgroundColor: colours.tint }} />
```

Use `className` for everything else — it keeps components clean and theme-aware with no extra code.

## Persistence

The chosen theme is stored in AsyncStorage under the key `@fieldreportx/theme` and optionally written to the local SQLite `User` table when a `firebaseUid` is available. On launch, the saved preference is restored; if none exists the app follows the device light/dark setting.
