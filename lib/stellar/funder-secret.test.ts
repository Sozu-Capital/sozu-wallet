import { afterEach, describe, expect, it } from "vitest"
import { Keypair } from "@stellar/stellar-sdk"
import {
  funderKeypairFromResolution,
  resolveFunderSecret,
} from "@/lib/stellar/funder-secret"
import {
  normalizeStellarNetwork,
  resolveHorizonUrlForNetwork,
  resolveSorobanRpcUrlForNetwork,
} from "@/lib/stellar/network-env"
import { getStellarConfig } from "@/lib/turnkey/config"

const ENV_KEYS = [
  "STELLAR_NETWORK",
  "STELLAR_FUNDER_SECRET",
  "STELLAR_FUNDER_SECRET_TESTNET",
  "STELLAR_FUNDER_SECRET_MAINNET",
  "STELLAR_FUNDER_SECRET_PUBLIC",
  "SOROBAN_RPC_URL",
  "SOROBAN_RPC_URL_TESTNET",
  "SOROBAN_RPC_URL_MAINNET",
  "NEXT_PUBLIC_SOROBAN_RPC_URL",
  "STELLAR_HORIZON_URL",
  "STELLAR_HORIZON_URL_TESTNET",
  "STELLAR_HORIZON_URL_MAINNET",
] as const

const original = new Map<string, string | undefined>(
  ENV_KEYS.map((key) => [key, process.env[key]]),
)

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = original.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

function clearFunderEnv() {
  for (const key of ENV_KEYS) delete process.env[key]
}

describe("resolveFunderSecret", () => {
  it("uses the testnet secret and ignores the mainnet secret", () => {
    clearFunderEnv()
    const testnet = Keypair.random()
    const mainnet = Keypair.random()
    const legacy = Keypair.random()
    process.env.STELLAR_FUNDER_SECRET_TESTNET = testnet.secret()
    process.env.STELLAR_FUNDER_SECRET_MAINNET = mainnet.secret()
    process.env.STELLAR_FUNDER_SECRET = legacy.secret()

    const resolved = resolveFunderSecret("testnet")
    expect(resolved.envName).toBe("STELLAR_FUNDER_SECRET_TESTNET")
    expect(resolved.network).toBe("testnet")
    expect(funderKeypairFromResolution(resolved)?.publicKey()).toBe(testnet.publicKey())
  })

  it("uses the mainnet secret when the network is public", () => {
    clearFunderEnv()
    const testnet = Keypair.random()
    const mainnet = Keypair.random()
    process.env.STELLAR_FUNDER_SECRET_TESTNET = testnet.secret()
    process.env.STELLAR_FUNDER_SECRET_MAINNET = mainnet.secret()

    const resolved = resolveFunderSecret("public")
    expect(resolved.envName).toBe("STELLAR_FUNDER_SECRET_MAINNET")
    expect(resolved.network).toBe("mainnet")
    expect(funderKeypairFromResolution(resolved)?.publicKey()).toBe(mainnet.publicKey())
  })

  it("accepts STELLAR_FUNDER_SECRET_PUBLIC as a mainnet alias", () => {
    clearFunderEnv()
    const mainnet = Keypair.random()
    process.env.STELLAR_FUNDER_SECRET_PUBLIC = mainnet.secret()

    const resolved = resolveFunderSecret("mainnet")
    expect(resolved.envName).toBe("STELLAR_FUNDER_SECRET_PUBLIC")
    expect(funderKeypairFromResolution(resolved)?.publicKey()).toBe(mainnet.publicKey())
  })

  it("falls back to STELLAR_FUNDER_SECRET only when the network secret is unset", () => {
    clearFunderEnv()
    const legacy = Keypair.random()
    process.env.STELLAR_FUNDER_SECRET = legacy.secret()
    process.env.STELLAR_FUNDER_SECRET_MAINNET = Keypair.random().secret()

    const testnet = resolveFunderSecret("testnet")
    expect(testnet.envName).toBe("STELLAR_FUNDER_SECRET")
    expect(funderKeypairFromResolution(testnet)?.publicKey()).toBe(legacy.publicKey())

    const mainnet = resolveFunderSecret("mainnet")
    expect(mainnet.envName).toBe("STELLAR_FUNDER_SECRET_MAINNET")
  })

  it("names the missing network secret", () => {
    clearFunderEnv()
    const resolved = resolveFunderSecret("testnet")
    expect(resolved.secret).toBeNull()
    expect(resolved.expectedEnvName).toBe("STELLAR_FUNDER_SECRET_TESTNET")
  })

  it("rejects a secret that is not a Stellar key", () => {
    clearFunderEnv()
    process.env.STELLAR_FUNDER_SECRET_TESTNET = "not-a-stellar-secret"
    const resolved = resolveFunderSecret("testnet")
    expect(resolved.secret).toBe("not-a-stellar-secret")
    expect(funderKeypairFromResolution(resolved)).toBeNull()
  })
})

describe("network endpoints", () => {
  it("treats public and mainnet as the same network", () => {
    expect(normalizeStellarNetwork("public")).toBe("mainnet")
    expect(normalizeStellarNetwork("pubnet")).toBe("mainnet")
    expect(normalizeStellarNetwork("testnet")).toBe("testnet")
  })

  it("does not send mainnet fee-payer calls to a testnet RPC", () => {
    clearFunderEnv()
    process.env.STELLAR_NETWORK = "testnet"
    process.env.SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org"

    expect(resolveSorobanRpcUrlForNetwork("testnet")).toBe("https://soroban-testnet.stellar.org")
    expect(resolveSorobanRpcUrlForNetwork("mainnet")).toBe("https://soroban.stellar.org")
  })

  it("prefers the network-specific RPC", () => {
    clearFunderEnv()
    process.env.SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org"
    process.env.SOROBAN_RPC_URL_MAINNET = "https://rpc.example.com/mainnet"

    expect(resolveSorobanRpcUrlForNetwork("mainnet")).toBe("https://rpc.example.com/mainnet")
  })

  it("does not use a testnet Horizon URL for mainnet", () => {
    clearFunderEnv()
    process.env.STELLAR_NETWORK = "mainnet"
    process.env.STELLAR_HORIZON_URL = "https://horizon-testnet.stellar.org"

    expect(resolveHorizonUrlForNetwork("mainnet")).toBe("https://horizon.stellar.org")
    expect(resolveHorizonUrlForNetwork("testnet")).toBe("https://horizon-testnet.stellar.org")
  })

  it("getStellarConfig maps public to mainnet", () => {
    clearFunderEnv()
    process.env.STELLAR_NETWORK = "public"
    const cfg = getStellarConfig()
    expect(cfg.network).toBe("mainnet")
    expect(cfg.horizonUrl).toBe("https://horizon.stellar.org")
  })
})
