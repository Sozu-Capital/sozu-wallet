import { describe, expect, it } from "vitest"
import {
  Account,
  Address,
  Asset,
  Contract,
  Keypair,
  Networks,
  SorobanDataBuilder,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk"
import { isBadSequenceResult, resequenceOnFeePayer, waitForSourceSequence, withFeePayerLock } from "./soroban-fee-payer"
import { xdrField, xdrType } from "./xdr-access"

const funder = Keypair.random()
const usdc = new Asset("USDC", Keypair.random().publicKey()).contractId(Networks.TESTNET)

function signedLookingTransfer(sequence: string) {
  const op = new Contract(usdc).call(
    "transfer",
    Address.fromString(Keypair.random().publicKey()).toScVal(),
    Address.fromString(Keypair.random().publicKey()).toScVal(),
    nativeToScVal(BigInt(1_000_000), { type: "i128" }),
  )
  const auth = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Contract(usdc).address().toScAddress(),
          functionName: "transfer",
          args: [],
        }),
      ),
      subInvocations: [],
    }),
  })
  const body = op.body()
  if (body.switch().name !== "invokeHostFunction") throw new Error("expected invoke host function")
  const host = body.invokeHostFunctionOp()
  const withAuth = new xdr.Operation({
    sourceAccount: op.sourceAccount(),
    body: xdr.OperationBody.invokeHostFunction(
      new xdr.InvokeHostFunctionOp({ hostFunction: host.hostFunction(), auth: [auth] }),
    ),
  })
  return new TransactionBuilder(new Account(funder.publicKey(), sequence), {
    fee: "12345",
    networkPassphrase: Networks.TESTNET,
    sorobanData: new SorobanDataBuilder().setResourceFee(5000).build(),
  })
    .addOperation(withAuth)
    .setTimeout(60)
    .build()
}

describe("resequenceOnFeePayer", () => {
  it("moves the envelope onto the fee payer's current sequence and keeps ops, auth, fee, and soroban data", async () => {
    const stale = signedLookingTransfer("100")
    expect(stale.sequence).toBe("101")
    const server = { getAccount: async (id: string) => new Account(id, "250") }

    const fresh = await resequenceOnFeePayer(server as never, stale, Networks.TESTNET)

    expect(fresh.sequence).toBe("251")
    expect(fresh.source).toBe(funder.publicKey())
    expect(fresh.fee).toBe(stale.fee)
    expect(fresh.timeBounds).toEqual(stale.timeBounds)
    const opsXdr = (t: typeof stale) => {
      const envelope = t.toEnvelope()
      if (xdrType(envelope) !== "envelopeTypeTx") throw new Error("expected v1 envelope")
      const inner = xdrField<object>(xdrField(envelope, "v1"), "tx")
      return xdrField<Array<{ toXDR: (encoding: string) => string }>>(inner, "operations").map((o) =>
        o.toXDR("base64"),
      )
    }
    expect(opsXdr(fresh)).toEqual(opsXdr(stale))
    const freshEnvelope = fresh.toEnvelope()
    if (xdrType(freshEnvelope) !== "envelopeTypeTx") throw new Error("expected v1 envelope")
    const ext = xdrField<object>(xdrField<object>(xdrField(freshEnvelope, "v1"), "tx"), "ext")
    if (xdrType(ext) !== "sorobanData") throw new Error("expected soroban data")
    expect(xdrField<{ toString(): string }>(xdrField(ext, "sorobanData"), "resourceFee").toString()).toBe("5000")
  })
})

describe("isBadSequenceResult", () => {
  const result = (name: "txBadSeq" | "txBadAuth") =>
    xdr.TransactionResult.fromXDR(
      new xdr.TransactionResult({
        feeCharged: BigInt(100),
        result: xdr.TransactionResultResult[name](),
        ext: new xdr.TransactionResultExt(0),
      }).toXDR(),
    )

  it("detects txBadSeq and nothing else", () => {
    expect(isBadSequenceResult({ status: "ERROR", errorResult: result("txBadSeq") })).toBe(true)
    expect(isBadSequenceResult({ status: "ERROR", errorResult: result("txBadAuth") })).toBe(false)
    expect(isBadSequenceResult({ status: "PENDING" })).toBe(false)
  })
})

describe("waitForSourceSequence", () => {
  it("waits until the source sequence catches the submitted transaction", async () => {
    let reads = 0
    const server = {
      getAccount: async (id: string) => {
        reads++
        return new Account(id, reads < 3 ? "40" : "41")
      },
    }
    const caught = await waitForSourceSequence(server as never, funder.publicKey(), "41", {
      attempts: 4,
      delayMs: 0,
    })
    expect(caught).toBe(true)
    expect(reads).toBe(3)
  })
})

describe("withFeePayerLock", () => {
  it("runs submits one at a time and keeps going after a failure", async () => {
    const events: string[] = []
    const job = (name: string, ms: number, fail = false) =>
      withFeePayerLock(async () => {
        events.push(`start ${name}`)
        await new Promise((r) => setTimeout(r, ms))
        events.push(`end ${name}`)
        if (fail) throw new Error(name)
        return name
      })

    const results = await Promise.allSettled([job("a", 20, true), job("b", 5), job("c", 1)])

    expect(events).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"])
    expect(results.map((r) => r.status)).toEqual(["rejected", "fulfilled", "fulfilled"])
  })
})
