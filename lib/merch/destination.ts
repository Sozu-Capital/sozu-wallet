/**
 * USDC destination for merch payments.
 * The event address is recorded later (szw #57). Until then this is the configured testnet address.
 */
export function merchUsdcAddress(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.MERCH_USDC_ADDRESS?.trim().toUpperCase() ?? ""
  if (!/^[CG][A-Z2-7]{55}$/.test(value)) return null
  return value
}
