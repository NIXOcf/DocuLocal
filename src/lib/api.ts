import { clearAuth, loadAuth } from "@/lib/storage"

const BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/$/, "")

/** Error del backend (`{error, mensaje, detalle, ref}`) o de red (status 0). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly ref: string | null
  readonly detalle: Record<string, unknown>
  readonly retryAfter: number | null

  constructor(
    status: number,
    code: string,
    mensaje: string,
    ref: string | null = null,
    detalle: Record<string, unknown> = {},
    retryAfter: number | null = null,
  ) {
    super(mensaje)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.ref = ref
    this.detalle = detalle
    this.retryAfter = retryAfter
  }
}

let onUnauthorized: (() => void) | null = null

/** AuthProvider registra aquí cómo cerrar la sesión ante un 401. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  json?: unknown
  form?: FormData
  /** false en el login: un 401 allí es "credenciales inválidas", no sesión caducada. */
  auth?: boolean
  signal?: AbortSignal
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function toApiError(response: Response): Promise<ApiError> {
  const retryHeader = Number(response.headers.get("Retry-After"))
  const retryAfter = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : null
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Cuerpo vacío o no JSON: se usa un mensaje genérico.
  }
  const data = isRecord(body) ? body : {}
  let mensaje =
    typeof data.mensaje === "string" && data.mensaje !== ""
      ? data.mensaje
      : `Error inesperado del servidor (${response.status}).`
  if (response.status === 429 && retryAfter !== null) {
    mensaje += ` Reintenta en ${retryAfter} s.`
  }
  return new ApiError(
    response.status,
    typeof data.error === "string" ? data.error : "error",
    mensaje,
    typeof data.ref === "string" ? data.ref : null,
    isRecord(data.detalle) ? data.detalle : {},
    retryAfter,
  )
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", json, form, auth = true, signal } = options
  const headers: Record<string, string> = {}
  if (auth) {
    const stored = loadAuth()
    if (stored !== null) headers.Authorization = `Bearer ${stored.token}`
  }
  if (json !== undefined) headers["Content-Type"] = "application/json"

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    throw new ApiError(0, "sin_conexion", "No se pudo conectar con el servidor. Revisa tu conexión.")
  }

  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearAuth()
      onUnauthorized?.()
    }
    throw await toApiError(response)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** POST multipart con progreso de subida (0-100). Cancelable con `signal` (rechaza con AbortError). */
export function uploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", `${BASE_URL}${path}`)
    const stored = loadAuth()
    if (stored !== null) xhr.setRequestHeader("Authorization", `Bearer ${stored.token}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onerror = () =>
      reject(new ApiError(0, "sin_conexion", "No se pudo conectar con el servidor. Revisa tu conexión."))
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"))
    xhr.onload = () => {
      let body: unknown = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        // Cuerpo vacío o no JSON: se usa un mensaje genérico.
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body as T)
      if (xhr.status === 401) {
        clearAuth()
        onUnauthorized?.()
      }
      const data = isRecord(body) ? body : {}
      const retryHeader = Number(xhr.getResponseHeader("Retry-After"))
      const retryAfter = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : null
      let mensaje =
        typeof data.mensaje === "string" && data.mensaje !== ""
          ? data.mensaje
          : `Error inesperado del servidor (${xhr.status}).`
      if (xhr.status === 429 && retryAfter !== null) mensaje += ` Reintenta en ${retryAfter} s.`
      reject(
        new ApiError(
          xhr.status,
          typeof data.error === "string" ? data.error : "error",
          mensaje,
          typeof data.ref === "string" ? data.ref : null,
          isRecord(data.detalle) ? data.detalle : {},
          retryAfter,
        ),
      )
    }
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"))
    const onAbort = () => xhr.abort()
    signal?.addEventListener("abort", onAbort, { once: true })
    xhr.onloadend = () => signal?.removeEventListener("abort", onAbort)
    xhr.timeout = 120_000
    xhr.ontimeout = () =>
      reject(new ApiError(0, "timeout", "La subida tardó demasiado. Inténtalo de nuevo."))
    xhr.send(form)
  })
}

export function errorMessage(error: unknown, fallback = "Ocurrió un error inesperado."): string {
  return error instanceof ApiError ? error.message : fallback
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

export interface Page<T> {
  datos: T[]
  paginacion: { pagina: number; tamano: number; total: number; paginas: number }
}
