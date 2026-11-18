import { NextResponse } from "next/server"
import { hasFunderSecret } from "@/lib/stellar/funder-secret"
import {
  describeMissingSmartWalletEnv,
  isFactorySmartAccountConfigured,
  isSmartWalletProvisioningConfigured,
  resolveSorobanRpcUrl,
} from "@/lib/stellar/soroban-env"
import { isOzSmartAccountConfigured } from "@/lib/stellar/smartAccounts/ozConfig"

export async function GET() {
  const missing = describeMissingSmartWalletEnv()
  return NextResponse.json({
    ready: isSmartWalletProvisioningConfigured(),
    sorobanRpcUrl: resolveSorobanRpcUrl(),
    factory: isFactorySmartAccountConfigured(),
    oz: isOzSmartAccountConfigured(),
    hasFunder: hasFunderSecret(),
    missingEnv: missing || null,
  })
}
