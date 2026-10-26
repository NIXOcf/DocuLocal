/**
 * Utilidades de saneamiento de entradas (OWASP A03 - Inyección).
 *
 * No se escapa HTML a mano: React escapa toda la salida de texto, y escapar
 * dos veces mostraría entidades literales (&amp;lt;) al usuario. Estas
 * funciones eliminan caracteres peligrosos o engañosos y limitan longitudes.
 */

const LINE_FEED = 0x0a

// Marcas y overrides bidireccionales que permiten suplantar nombres
// (p. ej. "factura‮fdp.exe" se muestra como "facturaexe.pdf").
const BIDI_CODE_POINTS = new Set([
  0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067,
  0x2068, 0x2069,
])

// Separadores de ruta y caracteres reservados en nombres de archivo.
const FILENAME_RESERVED = new Set(["/", "\\", "<", ">", ":", '"', "|", "?", "*"])

const MAX_FILENAME_LENGTH = 120
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const ALLOWED_EXTENSIONS: readonly string[] = ["pdf", "docx", "xlsx"]

export type UploadValidation = { ok: true } | { ok: false; reason: string }

/** Caracteres de control C0 (U+0000–U+001F), DEL (U+007F) y C1 (U+0080–U+009F). */
function isControl(codePoint: number): boolean {
  return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)
}

function filterChars(input: string, keep: (char: string, codePoint: number) => boolean): string {
  let result = ""
  for (const char of input) {
    const codePoint = char.codePointAt(0) ?? 0
    if (keep(char, codePoint)) result += char
  }
  return result
}

/** Recorta por puntos de código para no partir pares sustitutos (emojis). */
function truncate(input: string, maxLength: number): string {
  const chars = Array.from(input)
  return chars.length > maxLength ? chars.slice(0, maxLength).join("") : input
}

export function sanitizeText(input: string, maxLength: number): string {
  const cleaned = filterChars(
    input.normalize("NFC"),
    (_, cp) => (cp === LINE_FEED || !isControl(cp)) && !BIDI_CODE_POINTS.has(cp),
  ).trim()
  return truncate(cleaned, Math.max(0, maxLength)).trim()
}

export function sanitizeFilename(name: string): string {
  const cleaned = filterChars(
    name.normalize("NFC"),
    (char, cp) =>
      !isControl(cp) && !BIDI_CODE_POINTS.has(cp) && !FILENAME_RESERVED.has(char),
  ).trim()
  const result = truncate(cleaned, MAX_FILENAME_LENGTH).trim()
  return result === "" ? "documento" : result
}

export function getExtension(name: string): string {
  const dot = name.lastIndexOf(".")
  if (dot <= 0 || dot === name.length - 1) return ""
  return name.slice(dot + 1).toLowerCase()
}

export function validateUpload(file: File): UploadValidation {
  const extension = getExtension(file.name.trim())
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      ok: false,
      reason: "Formato no permitido. Solo se aceptan archivos PDF, DOCX o XLSX.",
    }
  }
  if (file.size === 0) {
    return { ok: false, reason: "El archivo está vacío." }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "El archivo supera el tamaño máximo de 20 MB." }
  }
  return { ok: true }
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 KB"
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
