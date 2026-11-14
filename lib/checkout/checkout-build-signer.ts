/**
 * Passkey smart accounts sign with the credential, not a classic G key.
 * The payment builder returns signerPublicKey only for the old factory path.
 */
export function checkoutBuildSigner(build: {
  signMethod?: string | null;
  signerPublicKey?: unknown;
}): { signerPublicKey: string | null; error?: string } {
  const signer =
    typeof build.signerPublicKey === "string" && build.signerPublicKey.startsWith("G")
      ? build.signerPublicKey
      : null;

  if (build.signMethod === "smart_g_signer" && !signer) {
    return {
      signerPublicKey: null,
      error: "Factory signer (G…) missing. Sign in on the device that created this wallet.",
    };
  }

  return { signerPublicKey: signer };
}
