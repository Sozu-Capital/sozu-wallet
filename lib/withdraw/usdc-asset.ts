import { Asset, Networks } from "@stellar/stellar-sdk"
import type { StellarNetwork } from "@/lib/stellar/asset-types"

/** Circle USDC — the only asset withdraw-all moves. Issuers are public Circle accounts. */
export const CIRCLE_USDC_ISSUERS: Record<StellarNetwork, string> = {
  testnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  mainnet: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
}

export type WithdrawUsdcAsset = {
  code: "USDC"
  issuer: string
  /** Stellar Asset Contract id derived from code + issuer for the network. */
  contractId: string
  decimals: 7
}

export function networkPassphraseFor(network: StellarNetwork): string {
  return network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
}

export function getWithdrawUsdcAsset(network: StellarNetwork): WithdrawUsdcAsset {
  const issuer = CIRCLE_USDC_ISSUERS[network]
  return {
    code: "USDC",
    issuer,
    contractId: new Asset("USDC", issuer).contractId(networkPassphraseFor(network)),
    decimals: 7,
  }
}
