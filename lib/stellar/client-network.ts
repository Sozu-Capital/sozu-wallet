export type ClientStellarNetwork = "testnet" | "mainnet"

/** Network baked into the client build via NEXT_PUBLIC_STELLAR_NETWORK. */
export function clientStellarNetwork(): ClientStellarNetwork {
  const raw = (process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet").trim().toLowerCase()
  if (
    raw === "mainnet" ||
    raw === "public" ||
    raw === "pubnet" ||
    raw === "stellar:public" ||
    raw === "stellar:pubnet"
  ) {
    return "mainnet"
  }
  return "testnet"
}
