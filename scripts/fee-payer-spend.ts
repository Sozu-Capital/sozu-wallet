/**
 * Fees an account paid, from Horizon, for the pilot closeout (szc #30).
 *
 *   npx tsx scripts/fee-payer-spend.ts --account G… [--network public|testnet] [--since 2026-11-01] [--until 2026-12-01]
 *
 * Counts every transaction where the account was the fee account (fee-bump payer or source).
 */
import { Horizon } from "@stellar/stellar-sdk"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const account = arg("account")?.trim().toUpperCase()
  if (!account?.startsWith("G")) throw new Error("--account G… is required")
  const network = arg("network") ?? "public"
  const since = arg("since") ? new Date(arg("since")!) : new Date(0)
  const until = arg("until") ? new Date(arg("until")!) : new Date(8.64e15)
  const horizon = new Horizon.Server(
    network === "public" ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org",
  )

  let page = await horizon
    .transactions()
    .forAccount(account)
    .includeFailed(true)
    .order("asc")
    .limit(200)
    .call()
  let count = 0
  let stroops = BigInt(0)
  while (page.records.length) {
    for (const tx of page.records) {
      const at = new Date(tx.created_at)
      if (at < since) continue
      if (at >= until) return report()
      if (tx.fee_account !== account) continue
      count++
      stroops += BigInt(tx.fee_charged)
    }
    page = await page.next()
  }
  return report()

  function report() {
    const xlm = Number(stroops) / 1e7
    console.log(`${account} on ${network}: ${count} transactions, ${xlm.toFixed(7)} XLM in fees`)
    console.log(`Window: ${since.toISOString()} → ${until.getTime() >= 8.64e15 ? "now" : until.toISOString()}`)
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
