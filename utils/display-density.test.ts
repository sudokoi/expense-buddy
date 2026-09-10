import { densityTabHeight } from "../constants/display-density"
import { cn } from "./cn"

it("keeps system insets intact and reserves additional tab space for large text", () => {
  expect(densityTabHeight("compact", 1, 24)).toBe(76)
  expect(densityTabHeight("standard", 1, 24)).toBe(88)
  expect(densityTabHeight("compact", 1.5, 24)).toBe(88)
  expect(densityTabHeight("compact", 0.85, 24)).toBe(76)
})

it("merges typography independently of color and allows amount-height overrides", () => {
  expect(cn("text-label text-foreground", "text-xs")).toBe("text-foreground text-xs")
  expect(cn("text-body", "text-muted-foreground")).toBe("text-body text-muted-foreground")
  expect(cn("min-h-control-height", "min-h-control-amount")).toBe("min-h-control-amount")
})
