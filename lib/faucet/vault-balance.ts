import "server-only";

import {
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import { Api } from "@stellar/stellar-sdk/rpc";
import { isFaucetContractConfigured, vaultCoversClaim } from "@/lib/faucet/network-policy";
import { getConfiguredFunderPublicKey } from "@/lib/stellar/soroban-fee-payer";
import { getStellarConfig } from "@/lib/turnkey/config";

const TOKEN_DECIMALS = 7;

function getFaucetContractId(): string | null {
  if (!isFaucetContractConfigured()) return null;
  return process.env.FAUCET_CONTRACT_ID!.trim().toUpperCase();
}

/** Simulation source: the faucet treasury when it is set, else the testnet funder. */
function simulationSourcePublicKey(): string | null {
  const treasury = process.env.FAUCET_TREASURY_SECRET?.trim();
  if (treasury) {
    try {
      return Keypair.fromSecret(treasury).publicKey();
    } catch {
      return null;
    }
  }
  return getConfiguredFunderPublicKey();
}

function getSorobanRpcUrl(): string {
  const network = getStellarConfig().network;
  return (
    process.env.SOROBAN_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    (network === "testnet"
      ? "https://soroban-testnet.stellar.org"
      : "https://soroban.stellar.org")
  );
}

const BALANCE_CACHE_MS = 30_000;
let balanceCache: { minor: bigint; at: number } | null = null;

/**
 * On-chain USDC balance held by the faucet vault contract (minor units).
 * `cached: true` accepts a per-instance reading up to 30 s old (status); claims read fresh.
 */
export async function getFaucetVaultBalanceMinor(
  opts: { cached?: boolean } = {},
): Promise<bigint | null> {
  if (
    opts.cached &&
    balanceCache &&
    Date.now() - balanceCache.at < BALANCE_CACHE_MS
  ) {
    return balanceCache.minor;
  }
  const minor = await readFaucetVaultBalanceMinor();
  if (minor !== null) balanceCache = { minor, at: Date.now() };
  return minor;
}

async function readFaucetVaultBalanceMinor(): Promise<bigint | null> {
  const contractId = getFaucetContractId();
  const sourcePk = simulationSourcePublicKey();
  if (!contractId || !sourcePk) return null;

  const cfg = getStellarConfig();
  const network = cfg.network === "mainnet" ? "mainnet" : "testnet";

  const server = new rpc.Server(getSorobanRpcUrl(), { allowHttp: network === "testnet" });
  const account = await server.getAccount(sourcePk);
  const faucet = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
  })
    .addOperation(faucet.call("balance"))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (Api.isSimulationError(sim) || !sim.result?.retval) return null;

  const native = scValToNative(sim.result.retval);
  if (typeof native === "bigint") return native;
  if (typeof native === "number") return BigInt(Math.trunc(native));
  if (typeof native === "string") return BigInt(native);
  return null;
}

/**
 * True when the vault can cover `amountUsdc`.
 * Unreadable balance with a configured contract refuses the claim.
 */
export async function vaultCanCoverClaim(
  amountUsdc: number,
  opts: { cached?: boolean } = {},
): Promise<boolean> {
  const contractConfigured = isFaucetContractConfigured();
  const minor = contractConfigured ? await getFaucetVaultBalanceMinor(opts) : null;
  return vaultCoversClaim({
    contractConfigured,
    balanceMinor: minor,
    amountUsdc,
  });
}

export function minorToUsdc(minor: bigint): number {
  return Number(minor) / 10 ** TOKEN_DECIMALS;
}

export function usdcToMinor(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** TOKEN_DECIMALS));
}
