import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/session"
import { markWalletDepositClaim, reserveWalletDepositClaim } from "@/lib/db/sozu-faucet-claims"
import { getSozuFaucetUrl } from "@/lib/sozu-faucet/config"
import { mintSozuFaucetToken } from "@/lib/sozu-faucet/mint-token"
import { faucetFailureConsumesDailyClaim } from "@/lib/sozu-faucet/wallet-claim-limit"
import { getStellarConfig } from "@/lib/turnkey/config"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type ClaimBody = {
  to?: string
}

type FaucetClaimJson = {
  success?: boolean
  amount?: number
  to?: string
  txHash?: string
  error?: string
  reason?: string
  nextAvailableAt?: string
  asset?: string
  network?: string
}

function isValidStellarAddress(addr: string): boolean {
  return /^[CG][A-Z0-9]{55}$/.test(addr)
}

/**
 * POST /api/wallet/sozu-faucet/claim
 * One-click testnet Circle USDC via standalone Sozu Faucet (Mode A JWT).
 * One successful claim per wallet and per account per 24 hours.
 */
export async function POST(request: Request) {
  const auth = requireSession(request)
  if (auth.error) return auth.error
  const { userId } = auth

  const stellar = getStellarConfig()
  if (stellar.network !== "testnet") {
    return NextResponse.json(
      {
        success: false,
        error: "Sozu Faucet is only available on testnet.",
        reason: "mainnet_refused",
      },
      { status: 403 },
    )
  }

  let body: ClaimBody = {}
  try {
    body = (await request.json()) as ClaimBody
  } catch {
    body = {}
  }

  let claimId: string | null = null

  try {
    const wallet = await getStellarWallet(userId, true).catch(() => null)
    const dbAddress = wallet?.publicKey?.trim().toUpperCase() ?? null
    const requested = body.to?.trim().toUpperCase() ?? null

    let walletAddress = dbAddress
    if (!walletAddress && requested && isValidStellarAddress(requested)) {
      walletAddress = requested
    }
    if (
      walletAddress &&
      requested &&
      isValidStellarAddress(requested) &&
      requested !== walletAddress
    ) {
      // Prefer explicit C… from the client when DB still has a legacy G.
      if (requested.startsWith("C") && walletAddress.startsWith("G")) {
        walletAddress = requested
      } else if (requested !== walletAddress) {
        return NextResponse.json(
          {
            success: false,
            error: "Recipient must match your Sozu wallet address.",
            reason: "unauthorized",
          },
          { status: 403 },
        )
      }
    }

    if (!walletAddress || !isValidStellarAddress(walletAddress)) {
      return NextResponse.json(
        {
          success: false,
          error: "No Stellar wallet found. Finish setup, then try again.",
          reason: "wallet_missing",
        },
        { status: 422 },
      )
    }

    try {
      const reserved = await reserveWalletDepositClaim({ userId, walletAddress })
      if (!reserved.ok) {
        return NextResponse.json(
          {
            success: false,
            error: "This wallet already claimed testnet USDC today.",
            reason: "wallet_daily_limit",
            nextAvailableAt: reserved.nextAvailableAt,
            to: walletAddress,
          },
          { status: 429 },
        )
      }
      claimId = reserved.claimId
    } catch (err) {
      console.error("[sozu-faucet/claim] reserve", err)
      return NextResponse.json(
        {
          success: false,
          error: "Faucet claim limit is unavailable. Try again in a moment.",
          reason: "claim_limit_unavailable",
        },
        { status: 503 },
      )
    }

    if (!claimId) {
      return NextResponse.json(
        {
          success: false,
          error: "Faucet claim limit is unavailable. Try again in a moment.",
          reason: "claim_limit_unavailable",
        },
        { status: 503 },
      )
    }
    const reservedClaimId = claimId

    const releaseClaim = async () => {
      await markWalletDepositClaim(reservedClaimId, "failed", null, null).catch((err) => {
        console.error("[sozu-faucet/claim] release", err)
      })
    }

    let token: string
    try {
      token = mintSozuFaucetToken({ userId, walletAddress })
    } catch (err) {
      console.error("[sozu-faucet/claim] mint", err)
      await releaseClaim()
      return NextResponse.json(
        {
          success: false,
          error: "Faucet auth is not configured on this deployment.",
          reason: "misconfigured",
        },
        { status: 503 },
      )
    }

    const faucetBase = getSozuFaucetUrl()
    const claimRes = await fetch(`${faucetBase}/api/v1/faucet/claim`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: walletAddress }),
      cache: "no-store",
    })

    const claimBody = (await claimRes.json().catch(() => ({}))) as FaucetClaimJson

    if (!claimRes.ok || !claimBody.success) {
      const reason = claimBody.reason ?? "payment_failed"
      if (faucetFailureConsumesDailyClaim(reason, claimRes.status)) {
        await markWalletDepositClaim(reservedClaimId, "success", claimBody.txHash ?? null, claimBody.amount ?? null).catch(
          (err) => console.error("[sozu-faucet/claim] consume", err),
        )
      } else {
        await releaseClaim()
      }
      return NextResponse.json(
        {
          success: false,
          amount: claimBody.amount ?? 100,
          error:
            claimBody.error ??
            `Faucet claim failed (${claimRes.status}). Try again shortly.`,
          reason,
          nextAvailableAt: claimBody.nextAvailableAt,
          to: walletAddress,
        },
        { status: claimRes.status >= 400 ? claimRes.status : 502 },
      )
    }

    await markWalletDepositClaim(
      reservedClaimId,
      "success",
      claimBody.txHash ?? null,
      typeof claimBody.amount === "number" ? claimBody.amount : null,
    ).catch((err) => console.error("[sozu-faucet/claim] complete", err))

    return NextResponse.json({
      success: true,
      amount: claimBody.amount ?? 100,
      asset: claimBody.asset ?? "circle_usdc_sac",
      network: "testnet",
      to: claimBody.to ?? walletAddress,
      txHash: claimBody.txHash,
      nextAvailableAt: claimBody.nextAvailableAt,
    })
  } catch (err) {
    console.error("[POST /api/wallet/sozu-faucet/claim]", err)
    if (claimId) {
      await markWalletDepositClaim(claimId, "failed", null, null).catch((releaseErr) => {
        console.error("[sozu-faucet/claim] release", releaseErr)
      })
    }
    return NextResponse.json(
      {
        success: false,
        error: "Could not reach Sozu Faucet. Try again in a moment.",
        reason: "payment_failed",
      },
      { status: 502 },
    )
  }
}
