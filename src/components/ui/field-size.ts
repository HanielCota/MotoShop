/**
 * Field heights paired with the `Button` scale (`button.tsx`):
 * - `default`: 44px everywhere, the minimum touch target, aligned with the default button.
 * - `sm`: 44px on phones, 36px from `sm` up, for dense filters and tables next to `Button size="sm"`.
 * - `lg`: 48px, next to `Button size="lg"` (search bands).
 * Use `size` instead of `className="h-*"`: a height override loses to the responsive base classes.
 */
export const fieldSizeClasses = {
  sm: "h-11 sm:h-9",
  default: "h-11",
  lg: "h-12",
} as const;

export type FieldSize = keyof typeof fieldSizeClasses;
