/** Stand-in for the pilot mainnet build. Derivation and factory provisioning are absent. */

function removed(name: string): never {
  throw new Error(`${name} is not in the mainnet build.`)
}

export const deriveStellarKeypair = () => removed("deriveStellarKeypair")
export const deriveKeypairWithSeed = () => removed("deriveKeypairWithSeed")
export const verifyKeyDerivation = () => removed("verifyKeyDerivation")
export const resolveKeypairForSignerG = () => removed("resolveKeypairForSignerG")
export const derivePrimaryPasskeySignerG = () => removed("derivePrimaryPasskeySignerG")
export const syncPasskeySignerToServer = () => removed("syncPasskeySignerToServer")
export const prepareSdpSigningMaterial = () => removed("prepareSdpSigningMaterial")
export const collectCredentialIdCandidates = () => removed("collectCredentialIdCandidates")
export const provisionSmartWalletForSigner = () => removed("provisionSmartWalletForSigner")
export const ensureFactorySmartWalletForUser = () => removed("ensureFactorySmartWalletForUser")
