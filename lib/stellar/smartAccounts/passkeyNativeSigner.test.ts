import { readFileSync } from "node:fs"
import path from "node:path"
import { Keypair } from "@stellar/stellar-sdk"
import { describe, expect, it } from "vitest"
import { deriveStellarKeypair } from "@/lib/webauthn/key-derivation"
import { selectSorobanFeePayer } from "@/lib/stellar/select-fee-payer"
import { ozKitDeployerKeypair } from "@/lib/stellar/smartAccounts/ozPin"
import {
  OZ_SMART_ACCOUNT_KIT_BINDINGS_VERSION,
  OZ_SMART_ACCOUNT_KIT_VERSION,
  OZ_SMART_ACCOUNT_WASM_HASH_TESTNET,
  OZ_STELLAR_CONTRACTS_VERSION,
  OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_TESTNET,
} from "@/lib/stellar/smartAccounts/ozPin"
import {
  assertOnlyPasskeyDefaultSigner,
  DEFAULT_CONTEXT_RULE_ID,
  exportCanRebuildSigningCapability,
  passkeyNativeDeploySigners,
  RECOVERY_CONTEXT_RULE_ID,
  summarizeDefaultRule,
} from "@/lib/stellar/smartAccounts/passkeyNativeSigner"

const verifier = OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_TESTNET
const credentialId = "dGVzdC1jcmVkZW50aWFs"
const userId = "11111111-1111-1111-1111-111111111111"
const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB3KM"

function passkeyPublicKey(): Uint8Array {
  const key = new Uint8Array(65)
  key[0] = 0x04
  key[1] = 0x11
  key[64] = 0x22
  return key
}

describe("passkey-native deploy signer", () => {
  it("deploys one External secp256r1 signer and leaves rule 1 free", () => {
    const publicKey65 = passkeyPublicKey()
    const signers = passkeyNativeDeploySigners({
      webauthnVerifierAddress: verifier,
      publicKey65,
      credentialIdBytes: Buffer.from("raw-id"),
    })
    expect(signers).toHaveLength(1)
    expect(signers[0].tag).toBe("External")
    expect(signers[0].values[0]).toBe(verifier)
    expect(signers[0].values[1].subarray(0, 65)).toEqual(Buffer.from(publicKey65))
    expect(DEFAULT_CONTEXT_RULE_ID).toBe(0)
    expect(RECOVERY_CONTEXT_RULE_ID).toBe(1)
  })

  it("accepts a default rule whose only signer is that passkey", () => {
    const publicKey65 = passkeyPublicKey()
    const keyData = Buffer.concat([Buffer.from(publicKey65), Buffer.from("raw-id")])
    const rule = {
      id: 0,
      signers: [["External", verifier, keyData]],
    }
    expect(() => assertOnlyPasskeyDefaultSigner(rule, { verifier, publicKey65 })).not.toThrow()
    expect(summarizeDefaultRule(rule).onlyPasskeyExternal).toBe(true)
  })

  it("rejects a second default signer and a delegated G signer", () => {
    const publicKey65 = passkeyPublicKey()
    const keyData = Buffer.concat([Buffer.from(publicKey65), Buffer.from("raw-id")])
    expect(() =>
      assertOnlyPasskeyDefaultSigner(
        { id: 0, signers: [["External", verifier, keyData], ["Delegated", "G".padEnd(56, "A")]] },
        { verifier, publicKey65 },
      ),
    ).toThrow(/exactly one/)
    expect(() =>
      assertOnlyPasskeyDefaultSigner({ id: 0, signers: [["Delegated", "G".padEnd(56, "A")]] }, { verifier, publicKey65 }),
    ).toThrow(/exactly one/)
  })
})

describe("fee payer sponsors passkey accounts", () => {
  const funder = Keypair.random().publicKey()

  it("uses the funder when the account has no G signer", () => {
    expect(selectSorobanFeePayer({ signerPublicKey: null, funderPublicKey: funder })).toEqual({
      feePayer: funder,
      usedFunder: true,
    })
  })

  it("refuses to make the user the fee payer when they have no G", () => {
    expect(() => selectSorobanFeePayer({ signerPublicKey: null, funderPublicKey: null })).toThrow(/do not hold XLM/)
  })

  it("keeps factory accounts on their existing G", () => {
    const signer = Keypair.random().publicKey()
    expect(
      selectSorobanFeePayer({
        signerPublicKey: signer,
        funderPublicKey: funder,
        requireSignerAsSource: true,
      }).feePayer,
    ).toBe(signer)
  })

  it("deploy source is the kit deployer, not a user key", () => {
    const deployer = ozKitDeployerKeypair().publicKey()
    expect(deployer.startsWith("G")).toBe(true)
    expect(deployer).not.toBe(funder)
  })
})

describe("database export and API responses cannot rebuild signing", () => {
  it("has no secret material, and HKDF(credential id, user id) is not a signer", async () => {
    const publicKey65 = passkeyPublicKey()
    const derived = await deriveStellarKeypair(credentialId, userId)
    const tables = {
      users: [{ id: userId, email: "ada@example.com" }],
      passkeys: [
        {
          user_id: userId,
          credential_id: credentialId,
          public_key: Buffer.from(publicKey65).toString("base64url"),
        },
      ],
      stellar_wallets: [
        {
          user_id: userId,
          public_key: contractId,
          wallet_type: "oz",
          oz_credential_id: credentialId,
          signer_public_key: null,
        },
      ],
    }
    const responses = [
      { credentialId, publicKey65b: Buffer.from(publicKey65).toString("base64url") },
      { passkeys: [{ credential_id: credentialId }] },
      { publicKey: contractId, walletType: "oz", signerPublicKey: null, network: "testnet" },
      { ok: true, contractId, walletType: "oz", credentialId },
      {
        signMethod: "oz_passkey",
        signerPublicKey: null,
        ozCredentialId: credentialId,
        walletAddress: contractId,
        feePayerPublicKey: Keypair.random().publicKey(),
        unsignedXdr: "AAAA",
      },
      { keyDataBase64: Buffer.from(publicKey65).toString("base64"), defaultSigner: { signerCount: 1, onlyPasskeyExternal: true, verifier } },
    ]

    expect(exportCanRebuildSigningCapability({ tables, responses })).toBe(false)
    const blob = JSON.stringify({ tables, responses })
    expect(blob.includes(derived.publicKey())).toBe(false)
    expect(derived.secret()).toMatch(/^S/)
    expect(blob.includes(derived.secret())).toBe(false)
  })

  it("flags a Stellar secret if one is present in the export", () => {
    const secret = Keypair.random().secret()
    expect(
      exportCanRebuildSigningCapability({
        tables: { stellar_wallets: [{ signer_secret: secret }] },
        responses: [],
      }),
    ).toBe(true)
  })
})

describe("OpenZeppelin pin", () => {
  it("matches package.json and records the testnet WASM and verifier", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "../../../package.json"), "utf8")) as {
      dependencies: Record<string, string>
    }
    expect(pkg.dependencies["smart-account-kit"]).toBe(OZ_SMART_ACCOUNT_KIT_VERSION)
    expect(pkg.dependencies["smart-account-kit-bindings"]).toBe(OZ_SMART_ACCOUNT_KIT_BINDINGS_VERSION)
    expect(OZ_STELLAR_CONTRACTS_VERSION).toBe("0.7.2")
    expect(OZ_SMART_ACCOUNT_WASM_HASH_TESTNET).toMatch(/^[0-9a-f]{64}$/)
    expect(OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_TESTNET).toMatch(/^C[A-Z0-9]{55}$/)
    const removed = readFileSync(path.resolve(__dirname, "../mainnet-removed-signer.ts"), "utf8")
    expect(removed).not.toMatch(/stellar-wallet-v1/)
    expect(removed.toLowerCase()).not.toContain("hkdf")
  })
})
