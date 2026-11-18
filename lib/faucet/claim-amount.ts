import { readFaucetNetwork } from "@/lib/faucet/network-policy";

/**
 * Mainnet pilot claim, in whole USDC.
 * `FAUCET_CLAIM_AMOUNT` is the testnet drip. It used to be shared with
 * production and kept mainnet claims at 10. Mainnet does not read it.
 */
export const MAINNET_PILOT_CLAIM_USDC = 15;

/**
 * Per-claim amount in whole USDC.
 * Mainnet always pays {@link MAINNET_PILOT_CLAIM_USDC}.
 * Testnet: FAUCET_CLAIM_AMOUNT env override, otherwise the faucet row.
 */
export function resolveClaimAmount(
  faucetAmount: number,
  env: NodeJS.ProcessEnv = process.env,
): number {
  if (readFaucetNetwork(env) === "mainnet") return MAINNET_PILOT_CLAIM_USDC;
  const raw = env.FAUCET_CLAIM_AMOUNT?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return faucetAmount;
}
