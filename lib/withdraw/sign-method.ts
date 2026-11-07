export type WithdrawSignMethod = "smart_g_signer" | "oz_passkey" | "oz_passkey_local"

/**
 * Same choice as a normal send: a factory smart account signs with its G signer
 * (and that G must be the fee-payer source). Passkey accounts use the OZ path.
 */
export function withdrawSignMethod(supportsOzKitApi: boolean, isFactoryOnChain: boolean): WithdrawSignMethod {
  if (!supportsOzKitApi && isFactoryOnChain) return "smart_g_signer"
  return supportsOzKitApi ? "oz_passkey" : "oz_passkey_local"
}
