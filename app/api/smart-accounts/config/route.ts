import { NextResponse } from "next/server"
import { resolveSorobanRpcUrlForNetwork, stellarNetworkPassphrase } from "@/lib/stellar/network-env"
import { getOzSmartAccountConfig } from "@/lib/stellar/smartAccounts/ozConfig"

export async function GET() {
  try {
    const cfg = getOzSmartAccountConfig()
    const networkPassphrase = stellarNetworkPassphrase()
    const rpcUrl = resolveSorobanRpcUrlForNetwork()

    return NextResponse.json({
      rpcUrl,
      networkPassphrase,
      accountWasmHash: cfg.accountWasmHash,
      webauthnVerifierAddress: cfg.webauthnVerifierContractId,
      thresholdPolicyAddress: cfg.thresholdPolicyContractId,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 503 })
  }
}
