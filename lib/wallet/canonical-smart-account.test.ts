import { describe, expect, it } from "vitest"
import {
  canonicalWriteDecision,
  pickTagOwner,
  selectCanonicalSmartAccount,
} from "@/lib/wallet/canonical-smart-account"

const OLD = "CDJVGT46QLTXLWY6GNWJ2UZOAWONZILHBKCF64E4AEEQRH3G4BA4AZ3F"
const NEWER = "CCJY33SGQ3VNQN52XLGSKFUDMTW4VG57527CFLQNSJKLLNRZVDDT2KGZ"
const CLASSIC = "GCFNUCUJ7WU32XGBP5A6GPDUYABQ7EXYBMSK7OEZG4YESBNNVG5BGTMJ"

describe("selectCanonicalSmartAccount", () => {
  it("keeps the stored smart account when an org treasury differs", () => {
    expect(
      selectCanonicalSmartAccount({
        walletPublicKey: NEWER,
        orgTreasuryContractId: OLD,
      }),
    ).toEqual({ contractId: NEWER, source: "stellar_wallets" })
  })

  it("adopts the org treasury only when the account has no smart account yet", () => {
    expect(
      selectCanonicalSmartAccount({
        walletPublicKey: CLASSIC,
        orgTreasuryContractId: OLD,
      }),
    ).toEqual({ contractId: OLD, source: "org_treasury" })
    expect(
      selectCanonicalSmartAccount({
        walletPublicKey: null,
        orgTreasuryContractId: OLD,
      }),
    ).toEqual({ contractId: OLD, source: "org_treasury" })
  })

  it("returns null when nothing is a smart account", () => {
    expect(selectCanonicalSmartAccount({ walletPublicKey: CLASSIC })).toBeNull()
  })
})

describe("pickTagOwner", () => {
  it("gives a case-variant tag to the account whose wallet was created first", () => {
    const owner = pickTagOwner([
      { id: "new", username: "frankocean", walletCreatedAt: "2026-11-15T21:50:23.081Z" },
      { id: "old", username: "FrankOcean", walletCreatedAt: "2026-11-08T16:10:49.823Z" },
    ])
    expect(owner?.id).toBe("old")
  })
})

describe("canonicalWriteDecision", () => {
  it("rejects a second contract for an account that already has one", () => {
    expect(canonicalWriteDecision(OLD, NEWER)).toEqual({ action: "reject", contractId: OLD })
    expect(canonicalWriteDecision(OLD, CLASSIC)).toEqual({ action: "reject", contractId: OLD })
  })

  it("keeps an identical write and allows the first assignment", () => {
    expect(canonicalWriteDecision(OLD, OLD.toLowerCase())).toEqual({
      action: "keep",
      contractId: OLD,
    })
    expect(canonicalWriteDecision(null, NEWER)).toEqual({ action: "write", contractId: NEWER })
    expect(canonicalWriteDecision(CLASSIC, NEWER)).toEqual({ action: "write", contractId: NEWER })
  })
})
