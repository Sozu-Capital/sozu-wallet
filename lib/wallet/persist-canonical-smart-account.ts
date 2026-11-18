import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getStellarConfig } from "@/lib/turnkey/config"
import {
  canonicalWriteDecision,
  isSmartAccountContractId,
  selectCanonicalSmartAccount,
  type CanonicalSmartAccountSource,
} from "@/lib/wallet/canonical-smart-account"

type ServiceClient = SupabaseClient

export type CanonicalSmartAccount = {
  contractId: string
  source: CanonicalSmartAccountSource
}

function service(): ServiceClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error("Server configuration error")
  return createClient(url, key)
}

async function readWalletPublicKey(
  svc: ServiceClient,
  userId: string,
): Promise<{ exists: boolean; publicKey: string | null }> {
  const { data, error } = await svc
    .from("stellar_wallets")
    .select("public_key")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const publicKey = typeof data?.public_key === "string" ? data.public_key.trim().toUpperCase() : null
  return { exists: !!data, publicKey }
}

async function readOrgTreasuryContract(svc: ServiceClient, userId: string): Promise<string | null> {
  const { data, error } = await svc
    .from("organizations")
    .select("treasury_smart_account_address, treasury_contract_id, soroban_contract_id")
    .eq("sozu_tag_auth_user_id", userId)
    .limit(1)
    .maybeSingle()
  const resolved = error?.message?.includes("treasury_contract_id")
    ? await svc
        .from("organizations")
        .select("treasury_smart_account_address, soroban_contract_id")
        .eq("sozu_tag_auth_user_id", userId)
        .limit(1)
        .maybeSingle()
    : { data, error }
  if (resolved.error || !resolved.data) return null
  const row = resolved.data as {
    treasury_smart_account_address?: string | null
    treasury_contract_id?: string | null
    soroban_contract_id?: string | null
  }
  for (const candidate of [
    row.treasury_smart_account_address,
    row.treasury_contract_id,
    row.soroban_contract_id,
  ]) {
    const value = candidate?.trim().toUpperCase() ?? ""
    if (isSmartAccountContractId(value)) return value
  }
  return null
}

export async function resolveCanonicalSmartAccount(
  userId: string,
): Promise<CanonicalSmartAccount | null> {
  const svc = service()
  const wallet = await readWalletPublicKey(svc, userId)
  let treasury: string | null = null
  try {
    treasury = await readOrgTreasuryContract(svc, userId)
  } catch {
    treasury = null
  }
  return selectCanonicalSmartAccount({
    walletPublicKey: wallet.publicKey,
    orgTreasuryContractId: treasury,
  })
}

/**
 * Persist `requested` only when this account has no smart account yet.
 * A different existing C… is returned unchanged and is not written.
 */
export async function assignCanonicalSmartAccount(
  userId: string,
  requestedContractId: string,
  extras?: Record<string, string | null>,
): Promise<{ contractId: string; written: boolean; immutable: boolean }> {
  const requested = requestedContractId.trim().toUpperCase()
  if (!isSmartAccountContractId(requested)) {
    throw new Error("CANONICAL_SMART_ACCOUNT_INVALID")
  }
  const svc = service()
  const current = await readWalletPublicKey(svc, userId)
  let treasury: string | null = null
  try {
    treasury = await readOrgTreasuryContract(svc, userId)
  } catch {
    treasury = null
  }
  const canonical = selectCanonicalSmartAccount({
    walletPublicKey: current.publicKey,
    orgTreasuryContractId: treasury,
  })
  if (canonical && canonical.contractId !== requested) {
    return { contractId: canonical.contractId, written: false, immutable: true }
  }
  if (canonical?.source === "stellar_wallets") {
    return { contractId: requested, written: false, immutable: false }
  }

  const decision = canonicalWriteDecision(current.publicKey, requested)
  if (decision.action === "reject") {
    return { contractId: decision.contractId, written: false, immutable: true }
  }
  if (decision.action === "keep") {
    return { contractId: decision.contractId, written: false, immutable: false }
  }

  const network = getStellarConfig().network
  const row: Record<string, string | null> = {
    ...extras,
    user_id: userId,
    public_key: requested,
    network,
    updated_at: new Date().toISOString(),
  }

  if (!current.exists) {
    const inserted = await svc.from("stellar_wallets").insert(row)
    if (inserted.error) {
      const again = await readWalletPublicKey(svc, userId)
      if (again.publicKey && isSmartAccountContractId(again.publicKey)) {
        return {
          contractId: again.publicKey,
          written: false,
          immutable: again.publicKey !== requested,
        }
      }
      throw new Error(inserted.error.message)
    }
  } else {
    let update = svc.from("stellar_wallets").update(row).eq("user_id", userId)
    if (current.publicKey) update = update.eq("public_key", current.publicKey)
    else update = update.is("public_key", null)
    const updated = await update.select("public_key")
    if (updated.error) throw new Error(updated.error.message)
    if (!updated.data?.length) {
      const again = await readWalletPublicKey(svc, userId)
      if (again.publicKey && isSmartAccountContractId(again.publicKey)) {
        return {
          contractId: again.publicKey,
          written: false,
          immutable: again.publicKey !== requested,
        }
      }
      throw new Error("Canonical smart account changed before it could be saved.")
    }
  }

  const stored = await readWalletPublicKey(svc, userId)
  const storedId = stored.publicKey && isSmartAccountContractId(stored.publicKey) ? stored.publicKey : requested
  return {
    contractId: storedId,
    written: storedId === requested,
    immutable: storedId !== requested,
  }
}

/** If the directory row has no C… yet, copy the org treasury in. Never deploys. */
export async function adoptCanonicalSmartAccountIfUnassigned(userId: string): Promise<string | null> {
  const resolved = await resolveCanonicalSmartAccount(userId)
  if (!resolved) return null
  if (resolved.source === "stellar_wallets") return resolved.contractId
  const assigned = await assignCanonicalSmartAccount(userId, resolved.contractId, {
    wallet_type: "oz",
  })
  return assigned.contractId
}
