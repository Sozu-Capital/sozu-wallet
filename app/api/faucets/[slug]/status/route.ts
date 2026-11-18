import { NextResponse } from "next/server";
import { computeFaucetAvailability, getFaucetBySlug, sumReservedFaucetUsdc, toPublicFaucet } from "@/lib/db/faucets";
import { resolveClaimAmount } from "@/lib/faucet/claim-amount";
import {
  decideFaucetPayout,
  isFaucetContractConfigured,
  isMainnetPilotArmed,
  mainnetPilotSlug,
  readFaucetNetwork,
} from "@/lib/faucet/network-policy";
import { tapCookieAllowsSlug } from "@/lib/faucet/tap-gate";
import { vaultCanCoverClaim } from "@/lib/faucet/vault-balance";
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet";
import type { FaucetStatusResponse } from "@/lib/faucet/types";
import { getSessionUserId } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/faucets/[slug]/status — faucet info + availability.
 * Requires the tap cookie set by /tap#secret. A shared /tap URL has no cookie.
 * When the caller has a session, user/wallet cooldown is included.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!tapCookieAllowsSlug(request.headers.get("cookie"), slug)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const faucet = await getFaucetBySlug(slug);
    if (!faucet) {
      return NextResponse.json({ error: "Faucet not found" }, { status: 404 });
    }

    // Optional user context for the user-cooldown rule.
    const userId = getSessionUserId(request);
    let walletAddress: string | null = null;
    if (userId) {
      const wallet = await getStellarWallet(userId, true).catch(() => null);
      walletAddress = wallet?.publicKey?.trim().toUpperCase() ?? null;
    }

    let availability = await computeFaucetAvailability(faucet, {
      userId,
      walletAddress,
    });

    const claimAmount = resolveClaimAmount(faucet.claim_amount);
    if (availability.available) {
      const network = readFaucetNetwork();
      const reservedUsdc = network === "mainnet" ? await sumReservedFaucetUsdc(faucet.id) : 0;
      const decision = decideFaucetPayout({
        network,
        pilotArmed: isMainnetPilotArmed(),
        slug: faucet.slug,
        amountUsdc: claimAmount,
        reservedUsdc,
        contractConfigured: isFaucetContractConfigured(),
        pilotSlug: mainnetPilotSlug(),
      });
      if (!decision.ok) {
        const reason = decision.reason;
        if (
          reason === "mainnet_refused" ||
          reason === "pilot_slug" ||
          reason === "pilot_cap" ||
          reason === "pilot_contract_required"
        ) {
          availability = {
            available: false,
            reason,
            remainingToday: availability.remainingToday,
          };
        }
      }
    }
    if (availability.available && !(await vaultCanCoverClaim(claimAmount, { cached: true }))) {
      availability = {
        available: false,
        reason: "insufficient_vault",
        remainingToday: availability.remainingToday,
      };
    }

    const response: FaucetStatusResponse = {
      faucet: toPublicFaucet(faucet),
      availability,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/faucets/[slug]/status]", err);
    return NextResponse.json({ error: "Failed to fetch faucet status" }, { status: 500 });
  }
}
