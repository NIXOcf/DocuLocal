import type {
  AccessLevel,
  Conversation,
  DocStatus,
  DocumentItem,
  Feedback,
  Message,
  Role,
  Source,
  UserSession,
} from "@/types"

/**
 * Type guards manuales para datos leídos del almacenamiento local (OWASP A08).
 * Cualquier dato que no cumpla exactamente el esquema se descarta.
 */

export const LIMITS = {
  conversations: 50,
  messagesPerConversation: 100,
  documents: 200,
  sourcesPerMessage: 10,
  idLength: 100,
  titleLength: 120,
  messageLength: 4000,
  filenameLength: 120,
  displayNameLength: 60,
  sizeLength: 20,
  dateLength: 40,
} as const

const ROLES: readonly Role[] = ["employee", "admin"]
const ACCESS_LEVELS: readonly AccessLevel[] = ["General", "Jefatura", "Gerencia"]
const DOC_STATUSES: readonly DocStatus[] = ["Indexado", "Procesando"]
const FEEDBACK_VALUES: readonly Feedback[] = ["up", "down", null]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isBoundedString(value: unknown, max: number, allowEmpty = false): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    (allowEmpty || value.length > 0)
  )
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function isOneOf<T>(value: unknown, options: readonly T[]): value is T {
  return options.some((option) => option === value)
}

function isSource(value: unknown): value is Source {
  return (
    isRecord(value) &&
    isBoundedString(value.id, LIMITS.idLength) &&
    isBoundedString(value.filename, LIMITS.filenameLength)
  )
}

function isMessage(value: unknown): value is Message {
  if (!isRecord(value)) return false
  if (!isBoundedString(value.id, LIMITS.idLength)) return false
  if (value.role !== "user" && value.role !== "assistant") return false
  if (!isBoundedString(value.content, LIMITS.messageLength)) return false
  if (!isTimestamp(value.createdAt)) return false
  if (value.sources !== undefined) {
    if (!Array.isArray(value.sources)) return false
    if (value.sources.length > LIMITS.sourcesPerMessage) return false
    if (!value.sources.every(isSource)) return false
  }
  if (value.feedback !== undefined && !isOneOf(value.feedback, FEEDBACK_VALUES)) {
    return false
  }
  return true
}

function isConversation(value: unknown): value is Conversation {
  return (
    isRecord(value) &&
    isBoundedString(value.id, LIMITS.idLength) &&
    isBoundedString(value.title, LIMITS.titleLength) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    Array.isArray(value.messages) &&
    value.messages.length <= LIMITS.messagesPerConversation &&
    value.messages.every(isMessage)
  )
}

function isDocumentItem(value: unknown): value is DocumentItem {
  return (
    isRecord(value) &&
    isBoundedString(value.id, LIMITS.idLength) &&
    isBoundedString(value.name, LIMITS.filenameLength) &&
    isBoundedString(value.size, LIMITS.sizeLength) &&
    isBoundedString(value.uploadedAt, LIMITS.dateLength) &&
    !Number.isNaN(Date.parse(value.uploadedAt)) &&
    isOneOf(value.status, DOC_STATUSES) &&
    isOneOf(value.accessLevel, ACCESS_LEVELS)
  )
}

export function isUserSession(value: unknown): value is UserSession {
  return (
    isRecord(value) &&
    isOneOf(value.role, ROLES) &&
    isBoundedString(value.displayName, LIMITS.displayNameLength) &&
    isTimestamp(value.loggedAt) &&
    isTimestamp(value.expiresAt) &&
    value.expiresAt > value.loggedAt
  )
}

export function isConversationList(value: unknown): value is Conversation[] {
  return (
    Array.isArray(value) &&
    value.length <= LIMITS.conversations &&
    value.every(isConversation) &&
    new Set(value.map((c) => c.id)).size === value.length
  )
}

export function isDocumentList(value: unknown): value is DocumentItem[] {
  return (
    Array.isArray(value) &&
    value.length <= LIMITS.documents &&
    value.every(isDocumentItem) &&
    new Set(value.map((d) => d.id)).size === value.length
  )
}
