/**
 * Único módulo autorizado para acceder a localStorage.
 *
 * IMPORTANTE (OWASP A02 / A07): aquí NUNCA se almacenan contraseñas, tokens
 * ni datos sensibles. La sesión guardada es SIMULADA y solo contiene el rol
 * y la caducidad para el prototipo. En producción la sesión debe gestionarla
 * el servidor mediante cookies httpOnly + Secure + SameSite, inaccesibles
 * desde JavaScript.
 *
 * OWASP A08: todo dato leído se trata como no confiable. Se valida con un
 * type guard antes de usarse; si está corrupto o fue manipulado en DevTools,
 * se descarta y se usa el valor por defecto.
 */

const PREFIX = "doculocal:v2:"

export const STORAGE_KEYS = {
  session: "session",
  conversations: "conversations",
  documents: "documents",
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

function getStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

export function safeRemove(key: StorageKey): void {
  try {
    getStore()?.removeItem(PREFIX + key)
  } catch {
    // Almacenamiento no disponible: no hay nada que borrar.
  }
}

export function safeGet<T>(
  key: StorageKey,
  validator: (value: unknown) => value is T,
  fallback: T,
): T {
  let raw: string | null
  try {
    const store = getStore()
    if (!store) return fallback
    raw = store.getItem(PREFIX + key)
  } catch {
    return fallback
  }

  if (raw === null) return fallback

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    safeRemove(key)
    return fallback
  }

  if (!validator(parsed)) {
    safeRemove(key)
    return fallback
  }
  return parsed
}

export function safeSet(key: StorageKey, value: unknown): boolean {
  try {
    const store = getStore()
    if (!store) return false
    store.setItem(PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    // Cuota llena, almacenamiento deshabilitado o modo privado:
    // la aplicación continúa funcionando solo en memoria.
    return false
  }
}
