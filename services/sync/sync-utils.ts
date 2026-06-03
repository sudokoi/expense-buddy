/** FNV-1a style hash for file content dedup */
export function simpleHash(content: string): string {
  let hash = 5381
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) ^ content.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash.toString(16)
}
