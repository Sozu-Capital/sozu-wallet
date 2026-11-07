/** NFC card path. Sozu Wallet creates the account. Sozu Faucet pays it. */
export const NFC_USDC_DROP_PATH = "/get/usdc"

/** Only this exact return is allowed after passkey auth. */
export function nfcUsdcDropReturnPath(redirect: string | null | undefined): string | null {
  return redirect?.trim() === NFC_USDC_DROP_PATH ? NFC_USDC_DROP_PATH : null
}
