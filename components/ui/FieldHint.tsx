"use client"

// Focus-triggered tooltip for a form field. The wrapping element needs
// `relative group` so `group-focus-within` can pick up focus on a
// descendant input — keeps it invisible until that specific field is
// actually focused, instead of always-on text cluttering every field.
export function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-max max-w-[260px] rounded-sm border border-border bg-surface px-2.5 py-1.5 text-xs text-muted opacity-0 invisible shadow-md transition-opacity duration-150 group-focus-within:opacity-100 group-focus-within:visible"
    >
      {children}
    </span>
  )
}
