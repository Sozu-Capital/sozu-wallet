import "server-only"

import { createClient as createServiceClient } from "@supabase/supabase-js"
import {
  earliestBlockingClaim,
  nextClaimAvailableAt,
  WALLET_DEPOSIT_FAUCET_SLUG,
  WALLET_FAUCET_CLAIM_AMOUNT,
  WALLET_FAUCET_CLAIM_WINDOW_MS,
} from "@/lib/sozu-faucet/wallet-claim-limit"

/**
 * Ledger for deposit-screen faucet claims.
 * Uses the existing faucet_claims table (same 24h wallet/user cooldown as physical orbs)
 * so a second tap cannot pay before a new migration is applied.
 */

type ClaimRow = {
  id: string
  claimed_at: string
  status: "pending" | "success" | "failed"
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase service role not configured")
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

let walletDepositFaucetId: string | null = null

async function walletDepositFaucetIdEnsured(): Promise<string> {
  if (walletDepositFaucetId) return walletDepositFaucetId
  const db = getServiceClient()
  const { data, error } = await db
    .from("faucets")
    .select("id")
    .eq("slug", WALLET_DEPOSIT_FAUCET_SLUG)
    .maybeSingle()
  if (error) throw new Error(`wallet faucet lookup: ${error.message}`)
  if (data?.id) {
    walletDepositFaucetId = data.id as string
    return walletDepositFaucetId
  }

  const { data: inserted, error: insertError } = await db
    .from("faucets")
    .insert({
      slug: WALLET_DEPOSIT_FAUCET_SLUG,
      name: "Wallet deposit claim",
      description:
        "Internal ledger for one testnet USDC claim per wallet per day. Not a physical faucet.",
      status: "inactive",
      location_name: "Sozu Wallet",
      lat: 0,
      lng: 0,
      daily_limit: 1_000_000,
      claim_amount: WALLET_FAUCET_CLAIM_AMOUNT,
      cooldown_minutes: 0,
    })
    .select("id")
    .single()

  if (!insertError && inserted?.id) {
    walletDepositFaucetId = inserted.id as string
    return walletDepositFaucetId
  }

  const { data: again, error: againError } = await db
    .from("faucets")
    .select("id")
    .eq("slug", WALLET_DEPOSIT_FAUCET_SLUG)
    .maybeSingle()
  if (againError || !again?.id) {
    throw new Error(`wallet faucet create: ${insertError?.message ?? againError?.message ?? "missing id"}`)
  }
  walletDepositFaucetId = again.id as string
  return walletDepositFaucetId
}

async function claimsInWindow(userId: string, walletAddress: string, nowMs: number): Promise<ClaimRow[]> {
  const since = new Date(nowMs - WALLET_FAUCET_CLAIM_WINDOW_MS).toISOString()
  const db = getServiceClient()
  const [byWallet, byUser] = await Promise.all([
    db
      .from("faucet_claims")
      .select("id, claimed_at, status")
      .eq("wallet_address", walletAddress)
      .in("status", ["pending", "success"])
      .gte("claimed_at", since),
    db
      .from("faucet_claims")
      .select("id, claimed_at, status")
      .eq("user_id", userId)
      .in("status", ["pending", "success"])
      .gte("claimed_at", since),
  ])
  if (byWallet.error) throw new Error(`faucet_claims wallet: ${byWallet.error.message}`)
  if (byUser.error) throw new Error(`faucet_claims user: ${byUser.error.message}`)

  const merged = new Map<string, ClaimRow>()
  for (const row of [...(byWallet.data ?? []), ...(byUser.data ?? [])] as ClaimRow[]) {
    merged.set(row.id, row)
  }
  return [...merged.values()]
}

function toStamps(rows: ClaimRow[]) {
  return rows.map((row) => ({
    id: row.id,
    claimedAtMs: new Date(row.claimed_at).getTime(),
    status: row.status,
  }))
}

export async function reserveWalletDepositClaim(params: {
  userId: string
  walletAddress: string
  now?: Date
}): Promise<{ ok: true; claimId: string } | { ok: false; nextAvailableAt: string }> {
  const nowMs = (params.now ?? new Date()).getTime()
  const walletAddress = params.walletAddress.trim().toUpperCase()
  const userId = params.userId.trim()
  const existing = earliestBlockingClaim(toStamps(await claimsInWindow(userId, walletAddress, nowMs)), nowMs)
  if (existing) {
    return { ok: false, nextAvailableAt: nextClaimAvailableAt(existing.claimedAtMs) }
  }

  const faucetId = await walletDepositFaucetIdEnsured()
  const db = getServiceClient()
  const { data: inserted, error } = await db
    .from("faucet_claims")
    .insert({
      faucet_id: faucetId,
      user_id: userId,
      wallet_address: walletAddress,
      amount: WALLET_FAUCET_CLAIM_AMOUNT,
      status: "pending",
    })
    .select("id, claimed_at, status")
    .single()
  if (error || !inserted) throw new Error(`faucet_claims insert: ${error?.message ?? "missing row"}`)

  const claim = inserted as ClaimRow
  const after = toStamps(await claimsInWindow(userId, walletAddress, nowMs))
  if (!after.some((row) => row.id === claim.id)) {
    after.push({
      id: claim.id,
      claimedAtMs: new Date(claim.claimed_at).getTime(),
      status: "pending",
    })
  }
  const winner = earliestBlockingClaim(after, nowMs)
  if (winner && winner.id !== claim.id) {
    await markWalletDepositClaim(claim.id, "failed", null, null)
    return { ok: false, nextAvailableAt: nextClaimAvailableAt(winner.claimedAtMs) }
  }
  return { ok: true, claimId: claim.id }
}

export async function markWalletDepositClaim(
  claimId: string,
  status: "success" | "failed",
  txHash: string | null,
  amount: number | null,
): Promise<void> {
  const db = getServiceClient()
  const patch: { status: "success" | "failed"; tx_hash: string | null; amount?: number } = {
    status,
    tx_hash: txHash,
  }
  if (amount != null && Number.isFinite(amount) && amount > 0) patch.amount = amount
  const { error } = await db.from("faucet_claims").update(patch).eq("id", claimId)
  if (error) throw new Error(`faucet_claims finalize: ${error.message}`)
}
