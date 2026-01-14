function extractSemverLike(value: string): string | null {
  const match = value.match(/\b\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/)
  return match?.[0] ?? null
}

function normalizeHeadingVersion(headingLine: string): string | null {
  // Expects something like:
  // - "## 2.1.0"
  // - "## v2.1.0"
  // - "## [2.1.0]"
  // - "## [v2.1.0]"
  const match = headingLine.match(/^##\s+(.+?)\s*$/)
  if (!match) return null

  let value = match[1].trim()
  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1).trim()
  }
  value = value.replace(/^v/i, "").trim()

  const semver = extractSemverLike(value)
  return semver ?? (value || null)
}

export function extractChangelogSection(markdown: string, version: string): string {
  const normalizedTarget = version.replace(/^v/i, "").trim()
  if (!normalizedTarget) return ""

  if (!markdown) return ""

  const lines = markdown.replace(/\r\n/g, "\n").split("\n")

  const startIndex = lines.findIndex((line) => {
    const normalized = normalizeHeadingVersion(line)
    return normalized === normalizedTarget
  })

  if (startIndex === -1) return ""

  const sectionLines: string[] = []
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^##\s+/.test(line)) {
      break
    }
    sectionLines.push(line)
  }

  return sectionLines.join("\n").trim()
}
