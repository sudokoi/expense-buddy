import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"
import profiles from "../constants/display-density.json"

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: [
        ...Object.keys(profiles.standard.space).map((key) => `ui-${key}`),
        ...Object.keys(profiles.standard.control).map((key) => `control-${key}`),
        ...Object.keys(profiles.standard.layout).map((key) => `layout-${key}`),
      ],
    },
    classGroups: { "font-size": [{ text: ["micro", "body", "label", "default"] }] },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
