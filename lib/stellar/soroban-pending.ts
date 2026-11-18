/** Thrown when a Soroban submit was accepted but did not reach a ledger before the wait ended. */
export class SorobanTransactionPendingError extends Error {
  readonly hash: string

  constructor(hash: string) {
    super(
      `Transaction ${hash} is still pending on Soroban RPC. Check Stellar Expert in a minute before sending again.`,
    )
    this.name = "SorobanTransactionPendingError"
    this.hash = hash
  }
}
