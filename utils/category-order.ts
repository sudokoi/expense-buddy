/** Move a category in the full order, keeping the built-in fallback at the end. */
export function moveCategory(
  labels: string[],
  label: string,
  direction: -1 | 1
): string[] {
  if (label === "Other") return labels
  const movable = labels.filter((item) => item !== "Other")
  const index = movable.indexOf(label)
  const target = index + direction
  if (index < 0 || target < 0 || target >= movable.length) return labels
  ;[movable[index], movable[target]] = [movable[target], movable[index]]
  return labels.includes("Other") ? [...movable, "Other"] : movable
}
