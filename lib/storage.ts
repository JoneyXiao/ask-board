const VOTER_KEY = 'askboard.voter_key'
const VOTED_KEY = 'askboard.voted_ids'
const HOST_TOKEN = 'askboard.host_token'
const HOST_EXPIRES = 'askboard.host_expires'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let memoryVoterKey: string | null = null
let memoryVoted = new Set<string>()

export function getOrCreateVoterKey(): string {
  try {
    const existing = window.localStorage.getItem(VOTER_KEY)
    if (existing && UUID_RE.test(existing)) return existing
    const created = randomUuid()
    window.localStorage.setItem(VOTER_KEY, created)
    return created
  } catch {
    if (!memoryVoterKey || !UUID_RE.test(memoryVoterKey)) memoryVoterKey = randomUuid()
    return memoryVoterKey
  }
}

export function loadVotedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(VOTED_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set(memoryVoted)
  }
}

export function saveVotedIds(ids: Set<string>): void {
  memoryVoted = new Set(ids)
  try {
    window.localStorage.setItem(VOTED_KEY, JSON.stringify([...ids]))
  } catch {
    // Private mode can reject storage; the in-memory set still covers this tab.
  }
}

export type StoredHostSession = {
  token: string
  expiresAt: string
}

export function loadHostSession(now = Date.now()): StoredHostSession | null {
  try {
    const token = window.sessionStorage.getItem(HOST_TOKEN)
    const expiresAt = window.sessionStorage.getItem(HOST_EXPIRES) ?? ''
    if (!token) return null
    if (expiresAt) {
      const expires = Date.parse(expiresAt)
      if (Number.isFinite(expires) && expires <= now) {
        clearHostSession()
        return null
      }
    }
    return { token, expiresAt }
  } catch {
    return null
  }
}

export function saveHostSession(token: string, expiresAt: string): void {
  window.sessionStorage.setItem(HOST_TOKEN, token)
  window.sessionStorage.setItem(HOST_EXPIRES, expiresAt)
}

export function clearHostSession(): void {
  try {
    window.sessionStorage.removeItem(HOST_TOKEN)
    window.sessionStorage.removeItem(HOST_EXPIRES)
  } catch {
    // Ignore storage failures; the in-memory token is cleared by the caller.
  }
}

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
