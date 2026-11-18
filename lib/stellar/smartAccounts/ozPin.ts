import { hash, Keypair } from "@stellar/stellar-sdk"

/** JS kit that submits passkey assertions. Pinned in package.json. */
export const OZ_SMART_ACCOUNT_KIT_VERSION = "0.2.10"
export const OZ_SMART_ACCOUNT_KIT_BINDINGS_VERSION = "0.1.2"

/**
 * OpenZeppelin stellar-contracts release that produced the WASM below.
 * Mainnet deployment of this same hash is szw #31; the verifier id for that
 * network is `OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_PUBLIC` and is not invented here.
 */
export const OZ_STELLAR_CONTRACTS_VERSION = "0.7.2"

export const OZ_SMART_ACCOUNT_WASM_HASH_TESTNET =
  "3e51f5b222dec74650f0b33367acb42a41ce497f72639230463070e666abba2c"

export const OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_TESTNET =
  "CATPTBRWVMH5ZCIKO5HN2F4FMPXVZEXC56RKGHRXCM7EEZGGXK7PICEH"

export const OZ_THRESHOLD_POLICY_CONTRACT_ID_TESTNET =
  "CDDQLFG7CV74QHWPSP6NZIPNBR2PPCMTUVYCJF4P3ONDYHODRFGR7LWC"

/**
 * Well-known OpenZeppelin kit deployer. Not a user key.
 * Contract ids are derived from this address; the Sozu fee payer fee-bumps the deploy.
 */
export function ozKitDeployerKeypair(): Keypair {
  return Keypair.fromRawEd25519Seed(hash(Buffer.from("openzeppelin-smart-account-kit")))
}
