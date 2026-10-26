/**
 * Genera un identificador único. Usa crypto.randomUUID() cuando está
 * disponible (contextos seguros) y, si no, construye un UUID v4 con
 * crypto.getRandomValues(). Nunca recurre a Math.random().
 */
export function createId(prefix?: string): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : fallbackUuid()
  return prefix ? `${prefix}-${uuid}` : uuid
}

function fallbackUuid(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
