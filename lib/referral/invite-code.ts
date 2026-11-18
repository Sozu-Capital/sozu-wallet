/**
 * Standing invite code for the $40 referral program.
 * Sharing stays off until INVITE_SHARING_ENABLED is turned on.
 * A confirmed signup (email confirmed) counts as 1 of INVITE_GOAL.
 */

export const INVITE_GOAL = 20
export const INVITE_REWARD_USD = 40
export const INVITE_SHARING_ENABLED = false

const HASH_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
const HASH_LENGTH = 4
const SLUG_MAX = 24

export function inviteSlug(username: string): string {
  const slug = username
    .trim()
    .toLowerCase()
    .replace(/^\$+/, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, SLUG_MAX)
  return slug.length > 0 ? slug : "sozu"
}

export function isInviteHash(value: string): boolean {
  return new RegExp(`^[${HASH_ALPHABET}]{${HASH_LENGTH}}$`).test(value)
}

export function randomInviteHash(): string {
  const bytes = new Uint8Array(HASH_LENGTH)
  crypto.getRandomValues(bytes)
  let hash = ""
  for (const byte of bytes) {
    hash += HASH_ALPHABET[byte % HASH_ALPHABET.length]
  }
  return hash
}

export function buildInviteCode(username: string, hash = randomInviteHash()): string {
  const suffix = isInviteHash(hash) ? hash : randomInviteHash()
  return `${inviteSlug(username)}-${suffix}`
}

export function inviteCodeMatchesUsername(code: string, username: string): boolean {
  const slug = inviteSlug(username).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${slug}-[${HASH_ALPHABET}]{${HASH_LENGTH}}$`).test(code)
}
