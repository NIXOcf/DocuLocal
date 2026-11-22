/**
 * Único módulo que accede al almacenamiento del navegador.
 *
 * El token JWT vive en sessionStorage (se pierde al cerrar la pestaña) junto con su
 * caducidad. Nunca se guarda en localStorage ni se registra en logs. Una cookie
 * httpOnly sería más robusta frente a XSS, pero requiere cambios en el backend.
 */

const AUTH_KEY = "doculocal:auth"
const LEGACY_PREFIX = "doculocal:v2:"

export interface StoredAuth {
  token: string
  expiresAt: number
}

function isStoredAuth(value: unknown): value is StoredAuth {
  if (typeof value !== "object" || value === null) return false
  const { token, expiresAt } = value as Record<string, unknown>
  return typeof token === "string" && token !== "" && typeof expiresAt === "number"
}

export function loadAuth(): StoredAuth | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (isStoredAuth(parsed) && parsed.expiresAt > Date.now()) return parsed
    sessionStorage.removeItem(AUTH_KEY)
  } catch {
    // Almacenamiento no disponible o dato corrupto: se trata como sin sesión.
  }
  return null
}

export function saveAuth(auth: StoredAuth): void {
  try {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth))
  } catch {
    // Sin almacenamiento: la sesión vive solo en memoria.
  }
}

export function clearAuth(): void {
  try {
    sessionStorage.removeItem(AUTH_KEY)
  } catch {
    // Nada que borrar.
  }
}

/** Elimina los datos sembrados por el prototipo (claves `doculocal:v2:*`). */
export function purgeLegacyStorage(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(LEGACY_PREFIX))
      .forEach((key) => localStorage.removeItem(key))
  } catch {
    // Almacenamiento no disponible.
  }
}

const PRIVACY_KEY = "doculocal:privacy-notice:v1"

export function hasSeenPrivacyNotice(): boolean {
  try {
    return localStorage.getItem(PRIVACY_KEY) === "1"
  } catch {
    return false
  }
}

export function markPrivacyNoticeSeen(): void {
  try {
    localStorage.setItem(PRIVACY_KEY, "1")
  } catch {
    // Sin almacenamiento: el aviso volverá a mostrarse.
  }
}
