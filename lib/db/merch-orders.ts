import "server-only"

import { createClient as createServiceClient } from "@supabase/supabase-js"
import type { MerchOrder, MerchOrderStatus, MerchOrderStore } from "@/lib/merch/order"

const TABLE = "merch_orders"
const MISSING_TABLE_CODES = new Set(["PGRST205", "42P01"])
const OPEN = ["awaiting_payment", "charging", "paid", "transferring"]

export class MerchOrderStoreUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MerchOrderStoreUnavailableError"
  }
}

type Row = {
  id: string
  attempt_id: string
  user_id: string
  slug: string
  payer: string
  price_usdc: string
  destination: string
  status: MerchOrderStatus
  payment_hash: string | null
  failure_reason: string | null
  transfer_hash: string | null
  transfer_attempted: boolean
  created_at?: string | null
}

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new MerchOrderStoreUnavailableError("Supabase service role not configured")
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

function raise(op: string, error: { code?: string; message: string }): never {
  if (error.code && MISSING_TABLE_CODES.has(error.code)) {
    throw new MerchOrderStoreUnavailableError(`${TABLE} missing (${op}): ${error.message}`)
  }
  throw new Error(`${TABLE} ${op}: ${error.message}`)
}

function toOrder(row: Row): MerchOrder {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    userId: row.user_id,
    slug: row.slug,
    payer: row.payer,
    priceUsdc: row.price_usdc,
    destination: row.destination,
    status: row.status,
    paymentHash: row.payment_hash,
    failureReason: row.failure_reason,
    transferHash: row.transfer_hash,
    transferAttempted: row.transfer_attempted,
    createdAt: row.created_at ?? null,
  }
}

function toRow(order: MerchOrder): Row {
  return {
    id: order.id,
    attempt_id: order.attemptId,
    user_id: order.userId,
    slug: order.slug,
    payer: order.payer,
    price_usdc: order.priceUsdc,
    destination: order.destination,
    status: order.status,
    payment_hash: order.paymentHash,
    failure_reason: order.failureReason,
    transfer_hash: order.transferHash,
    transfer_attempted: order.transferAttempted,
  }
}

export const supabaseMerchOrderStore: MerchOrderStore = {
  async getByAttempt(userId, attemptId) {
    const { data, error } = await db()
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .eq("attempt_id", attemptId)
      .maybeSingle()
    if (error) raise("select", error)
    return data ? toOrder(data as Row) : null
  },
  async getOpen(userId, slug) {
    const { data, error } = await db()
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .eq("slug", slug)
      .in("status", OPEN)
      .limit(1)
      .maybeSingle()
    if (error) raise("select open", error)
    return data ? toOrder(data as Row) : null
  },
  async insert(order) {
    const { error } = await db().from(TABLE).insert(toRow(order))
    if (!error) return order
    if (error.code === "23505") return "conflict"
    raise("insert", error)
  },
  async claimCharge(id) {
    const { data, error } = await db()
      .from(TABLE)
      .update({ status: "charging" })
      .eq("id", id)
      .eq("status", "awaiting_payment")
      .select("id")
    if (error) raise("claim", error)
    return Array.isArray(data) && data.length > 0
  },
  async claimTransfer(id) {
    const { data, error } = await db()
      .from(TABLE)
      .update({ status: "transferring", transfer_attempted: true })
      .eq("id", id)
      .eq("status", "paid")
      .is("transfer_hash", null)
      .select("id")
    if (error) raise("claim transfer", error)
    return Array.isArray(data) && data.length > 0
  },
  async save(order) {
    const { error } = await db().from(TABLE).update(toRow(order)).eq("id", order.id)
    if (error) raise("save", error)
  },
  async listByUser(userId) {
    const { data, error } = await db()
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
    if (error) raise("list", error)
    return (data as Row[]).map(toOrder)
  },
}
