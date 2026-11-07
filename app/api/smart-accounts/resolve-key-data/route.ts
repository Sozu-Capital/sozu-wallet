import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { xdr } from "@stellar/stellar-sdk"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { readDefaultContextRule, resolveOnChainSignerKeyData } from "@/lib/stellar/smartAccounts/resolveOnChainPublicKey"
import { getOzSmartAccountConfig } from "@/lib/stellar/smartAccounts/ozConfig"
import { summarizeDefaultRule } from "@/lib/stellar/smartAccounts/passkeyNativeSigner"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request)
  const contractId = request.nextUrl.searchParams.get("contractId")?.trim() ?? ""
  const credentialId = request.nextUrl.searchParams.get("credentialId")?.trim() ?? ""
  const authEntryXdr = request.nextUrl.searchParams.get("authEntryXdr")?.trim() ?? ""

  if (!contractId.startsWith("C") || !credentialId) {
    return NextResponse.json(
      { error: "contractId and credentialId are required." },
      { status: 400, headers },
    )
  }

  let authEntry: xdr.SorobanAuthorizationEntry | undefined
  if (authEntryXdr) {
    try {
      authEntry = xdr.SorobanAuthorizationEntry.fromXDR(authEntryXdr, "base64")
    } catch {
      return NextResponse.json({ error: "Invalid authEntryXdr." }, { status: 400, headers })
    }
  }

  const keyData = await resolveOnChainSignerKeyData({
    contractId,
    credentialId,
    authEntry,
  })

  if (!keyData) {
    return NextResponse.json(
      { error: "Signer keyData not found on this smart account." },
      { status: 404, headers },
    )
  }

  const rule = await readDefaultContextRule(contractId)
  const summary = summarizeDefaultRule(rule)
  let expectedVerifier: string | null = null
  try {
    expectedVerifier = getOzSmartAccountConfig().webauthnVerifierContractId
  } catch {
    expectedVerifier = null
  }
  const onlyPasskeyExternal =
    summary.onlyPasskeyExternal &&
    summary.signerCount === 1 &&
    (expectedVerifier === null || summary.verifier === expectedVerifier)

  return NextResponse.json(
    {
      keyDataBase64: keyData.toString("base64"),
      defaultSigner: {
        signerCount: summary.signerCount,
        onlyPasskeyExternal,
        verifier: summary.verifier,
      },
    },
    { headers },
  )
}
