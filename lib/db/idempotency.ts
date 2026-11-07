import "server-only"

import { createClient as createServiceClient } from "@supabase/supabase-js"
import {
  IdempotencyStoreUnavailableError,
  type IdempotencyRecord,
  type IdempotencyStore,
} from "@/lib/idempotency/idempotency"

const TABLE = "payment_idempotency_keys"

/** PostgREST / Postgres codes for "table does not exist". */
const MISSING_TABLE_CODES = new Set(["PGRST205", "42P01"])

type Row = {
  scope: string
  fingerprint: string
  status: "in_progress" | "completed"
  response_status: number | null
  response_body: unknown
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new IdempotencyStoreUnavailableError("Supabase service role not configured")
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

function toRecord(row: Row): IdempotencyRecord {
  return {
    scope: row.scope,
    fingerprint: row.fingerprint,
    status: row.status,
    responseStatus: row.response_status,
    responseBody: row.response_body,
  }
}

function raise(op: string, error: { code?: string; message: string }): never {
  if (error.code && MISSING_TABLE_CODES.has(error.code)) {
    throw new IdempotencyStoreUnavailableError(`${TABLE} missing (${op}): ${error.message}`)
  }
  throw new Error(`${TABLE} ${op}: ${error.message}`)
}

export const supabaseIdempotencyStore: IdempotencyStore = {
  async claim({ userId, key, scope, fingerprint }) {
    const db = getServiceClient()
    const { error } = await db.from(TABLE).insert({
      user_id: userId,
      idempotency_key: key,
      scope,
      fingerprint,
      status: "in_progress",
    })
    if (!error) return null
    if (error.code !== "23505") raise("insert", error)

    const { data, error: readError } = await db
      .from(TABLE)
      .select("scope, fingerprint, status, response_status, response_body")
      .eq("user_id", userId)
      .eq("idempotency_key", key)
      .single()
    if (readError) raise("select", readError)
    return toRecord(data as Row)
  },

  async complete({ userId, key, responseStatus, responseBody }) {
    const db = getServiceClient()
    const { error } = await db
      .from(TABLE)
      .update({
        status: "completed",
        response_status: responseStatus,
        response_body: responseBody,
        completed_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("idempotency_key", key)
    if (error) raise("update", error)
  },
}
