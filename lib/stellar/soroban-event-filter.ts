import { Address, xdr } from "@stellar/stellar-sdk"

/** Circle USDC publishes four topics: transfer, from, to, and a string. A shorter filter matches nothing. */
export const TRANSFER_TOPIC_COUNT = 4

export function transferEventFilters(contractId: string, holder: string): Array<{
  type: "contract"
  contractIds: string[]
  topics: string[][]
}> {
  const transfer = xdr.ScVal.scvSymbol("transfer").toXDR("base64")
  const who = Address.fromString(holder).toScVal().toXDR("base64")
  const wildcard = "*"
  return [
    {
      type: "contract",
      contractIds: [contractId],
      topics: [[transfer, who, wildcard, wildcard]],
    },
    {
      type: "contract",
      contractIds: [contractId],
      topics: [[transfer, wildcard, who, wildcard]],
    },
  ]
}
