import "server-only";

/**
 * sendFaucetPayment — faucet USDC payout.
 *
 * Preferred rail: the deployed Sozu Faucet vault contract
 * (contracts/faucet, env FAUCET_CONTRACT_ID). The server (treasury G =
 * contract admin) invokes `claim(to, amount)` and the contract pays out
 * Circle USDC from its own balance.
 *
 * Testnet may fall back to a direct SEP-41 transfer when no contract is set.
 * Mainnet pays only when the 300 USDC pilot is armed, and only by calling
 * claim() on the vault contract. The testnet funder key is never a mainnet signer.
 */

import {
  Address,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { Api } from "@stellar/stellar-sdk/rpc";
import { getFaucetBySlug, sumReservedFaucetUsdc } from "@/lib/db/faucets";
import {
  FaucetPolicyError,
  decideFaucetPayout,
  isFaucetContractConfigured,
  isMainnetPilotArmed,
  mainnetPilotSlug,
  resolveFaucetTreasurySecret,
  type FaucetNetwork,
} from "@/lib/faucet/network-policy";
import { getAssetById, getBlendUsdcAsset } from "@/lib/stellar/asset-registry";
import { normalizeHolderAddress } from "@/lib/stellar/stellar-holder";
import { ensureTestnetAccountFunded } from "@/lib/stellar/soroban-fee-payer";
import { xdrField, xdrType } from "@/lib/stellar/xdr-access";
import { resolveSorobanRpcUrlForNetwork } from "@/lib/stellar/network-env";
import { getStellarConfig } from "@/lib/turnkey/config";
import {
  getFaucetVaultBalanceMinor,
  minorToUsdc,
  vaultCanCoverClaim,
} from "@/lib/faucet/vault-balance";

const TOKEN_DECIMALS = 7;

export type SendFaucetPaymentParams = {
  toWalletAddress: string;
  /** Whole-token amount, e.g. 1 = 1 USDC. */
  amount: number;
  /** For logging/tracing, and for the mainnet pilot slug check. */
  faucetSlug: string;
  /**
   * True after the route inserted this claim as pending, so the reserved sum
   * already includes `amount` and must not be added twice.
   */
  pendingAlreadyReserved?: boolean;
};

export type SendFaucetPaymentResult = {
  txHash: string;
};

function getTreasuryKeypair(network: FaucetNetwork): Keypair {
  const resolved = resolveFaucetTreasurySecret({
    network,
    faucetTreasurySecret: process.env.FAUCET_TREASURY_SECRET,
    funderSecret: process.env.STELLAR_FUNDER_SECRET,
  });
  if (!resolved.ok) throw new FaucetPolicyError(resolved.reason);
  try {
    return Keypair.fromSecret(resolved.secret);
  } catch {
    throw new Error("FAUCET_TREASURY_SECRET is not a valid Stellar secret key.");
  }
}

/** Deployed Sozu Faucet vault contract (contracts/faucet). */
function getFaucetContractId(): string | null {
  if (!isFaucetContractConfigured()) return null;
  return process.env.FAUCET_CONTRACT_ID!.trim().toUpperCase();
}

/** Token to dispense on the fallback rail: Circle USDC SAC by default. */
function getFaucetTokenContractId(network: "testnet" | "mainnet"): string {
  const override = process.env.FAUCET_TOKEN_CONTRACT_ID?.trim().toUpperCase();
  if (override?.startsWith("C") && override.length === 56) return override;
  const circle = getAssetById("circle_usdc_sac", network);
  if (circle) return circle.contractId;
  return getBlendUsdcAsset(network).contractId;
}

function getSorobanRpcUrl(network: "testnet" | "mainnet"): string {
  return resolveSorobanRpcUrlForNetwork(network);
}

function amountToI128ScVal(amount: number, decimals: number): xdr.ScVal {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid faucet amount: ${amount}`);
  }
  const minor = BigInt(Math.round(amount * 10 ** decimals));
  return nativeToScVal(minor, { type: "i128" });
}

async function waitForResult(
  server: rpc.Server,
  hash: string,
  maxAttempts = 45,
): Promise<"SUCCESS" | "FAILED" | "PENDING"> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const tx = await server.getTransaction(hash);
      if (tx.status === Api.GetTransactionStatus.SUCCESS) return "SUCCESS";
      if (tx.status === Api.GetTransactionStatus.FAILED) return "FAILED";
    } catch {
      /* NOT_FOUND — keep polling */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return "PENDING";
}

/** Build, sign with treasury, submit, and wait for a single-op Soroban tx. */
async function submitTreasuryInvocation(params: {
  operation: xdr.Operation;
  faucetSlug: string;
  network: FaucetNetwork;
  treasury: Keypair;
}): Promise<string> {
  const treasuryPk = params.treasury.publicKey();

  if (params.network === "testnet") {
    await ensureTestnetAccountFunded(treasuryPk);
  }

  const server = new rpc.Server(getSorobanRpcUrl(params.network), {
    allowHttp: params.network === "testnet",
  });
  const account = await server.getAccount(treasuryPk);

  const rawTx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: params.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
  })
    .addOperation(params.operation)
    .setTimeout(60)
    .build();

  // Treasury is the tx source → its require_auth resolves to source-account
  // credentials, so the signature below is the only auth required.
  const prepared = await server.prepareTransaction(rawTx);
  prepared.sign(params.treasury);

  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR" || !sent.hash) {
    const detail = sent.errorResult
      ? xdrType(xdrField(sent.errorResult, "result")) ?? "unknown"
      : "no hash";
    throw new Error(
      `Faucet payment rejected by Soroban RPC (${detail}) [faucet=${params.faucetSlug}]`,
    );
  }

  const outcome = await waitForResult(server, sent.hash);
  if (outcome === "FAILED") {
    throw new Error(
      `Faucet payment failed on-chain (tx ${sent.hash.slice(0, 8)}…). ` +
        "Check the faucet vault / treasury USDC balance.",
    );
  }
  if (outcome === "PENDING") {
    throw new Error(
      `Faucet payment still pending after timeout (tx ${sent.hash.slice(0, 8)}…).`,
    );
  }
  return sent.hash;
}

async function reservedUsdcForSlug(slug: string): Promise<number> {
  const faucet = await getFaucetBySlug(slug);
  if (!faucet) throw new FaucetPolicyError("pilot_slug");
  return sumReservedFaucetUsdc(faucet.id);
}

export async function sendFaucetPayment(
  params: SendFaucetPaymentParams,
): Promise<SendFaucetPaymentResult> {
  const network: FaucetNetwork = getStellarConfig().network === "mainnet" ? "mainnet" : "testnet";
  const contractConfigured = isFaucetContractConfigured();
  const reservedUsdc =
    network === "mainnet" ? await reservedUsdcForSlug(params.faucetSlug) : 0;
  const decision = decideFaucetPayout({
    network,
    pilotArmed: isMainnetPilotArmed(),
    slug: params.faucetSlug,
    amountUsdc: params.amount,
    reservedUsdc,
    reservedIncludesAmount: params.pendingAlreadyReserved === true,
    contractConfigured,
    pilotSlug: mainnetPilotSlug(),
  });
  if (!decision.ok) {
    throw new FaucetPolicyError(decision.reason);
  }

  const to = normalizeHolderAddress(params.toWalletAddress);
  const amountScVal = amountToI128ScVal(params.amount, TOKEN_DECIMALS);
  const faucetContractId = getFaucetContractId();
  const treasury = getTreasuryKeypair(network);

  if (!(await vaultCanCoverClaim(params.amount))) {
    const minor = await getFaucetVaultBalanceMinor();
    const have = minor !== null ? minorToUsdc(minor) : 0;
    throw new Error(
      `Faucet vault underfunded: has ${have} USDC, need ${params.amount} USDC. ` +
        `Fund via ./scripts/faucet-vault.sh fund or lower FAUCET_CLAIM_AMOUNT.`,
    );
  }

  // Preferred: vault contract claim(to, amount), admin-gated.
  // Mainnet has no direct-transfer fallback — decideFaucetPayout already required the contract.
  if (faucetContractId) {
    const faucet = new Contract(faucetContractId);
    const txHash = await submitTreasuryInvocation({
      operation: faucet.call("claim", Address.fromString(to).toScVal(), amountScVal),
      faucetSlug: params.faucetSlug,
      network,
      treasury,
    });
    return { txHash };
  }

  // Testnet fallback: direct treasury SEP-41 transfer.
  const token = new Contract(getFaucetTokenContractId(network));
  const txHash = await submitTreasuryInvocation({
    operation: token.call(
      "transfer",
      Address.fromString(treasury.publicKey()).toScVal(),
      Address.fromString(to).toScVal(),
      amountScVal,
    ),
    faucetSlug: params.faucetSlug,
    network,
    treasury,
  });
  return { txHash };
}
