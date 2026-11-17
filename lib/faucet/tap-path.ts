/** Clean faucet path. The NFC/QR secret never stays in this URL. */
export const FAUCET_TAP_PATH = "/tap"

/**
 * Testnet faucet host. Staging is dev.sozu.capital.
 * Production (app.sozu.capital) is the mainnet wallet, not this faucet.
 */
export const TESTNET_FAUCET_ORIGIN = "https://dev.sozu.capital"

export function testnetFaucetTapUrl(secret: string): string {
  return `${TESTNET_FAUCET_ORIGIN}${FAUCET_TAP_PATH}#${secret}`
}

/** Auth may return only to the clean path. A slug or secret in the query is ignored. */
export function tapAuthReturnPath(redirect: string | null | undefined): string | null {
  return redirect?.trim() === FAUCET_TAP_PATH ? FAUCET_TAP_PATH : null
}
