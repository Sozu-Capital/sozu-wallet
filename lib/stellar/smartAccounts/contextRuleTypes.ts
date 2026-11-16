import { Address, xdr } from "@stellar/stellar-sdk"
import { xdrBytes, xdrField, xdrType } from "@/lib/stellar/xdr-access"

export type ContextRuleType =
  | { tag: "Default"; values: undefined }
  | { tag: "CallContract"; values: [string] }
  | { tag: "CreateContract"; values: [Buffer] }

/** Mirror smart-account-kit buildContextRuleTypes for signer keyData lookup. */
export function buildContextRuleTypesFromAuthEntry(
  entry: xdr.SorobanAuthorizationEntry,
): ContextRuleType[] {
  const types: ContextRuleType[] = []
  const seen = new Set<string>()

  const add = (type: ContextRuleType) => {
    let key: string
    if (type.tag === "Default") {
      key = "Default"
    } else if (type.tag === "CallContract") {
      key = `CallContract:${type.values[0]}`
    } else {
      key = `CreateContract:${type.values[0].toString("hex")}`
    }
    if (!seen.has(key)) {
      seen.add(key)
      types.push(type)
    }
  }

  const walk = (invocation: xdr.SorobanAuthorizedInvocation) => {
    const fn = xdrField<xdr.SorobanAuthorizedFunction>(invocation, "function")
    const fnType = xdrType(fn)
    if (fnType === "sorobanAuthorizedFunctionTypeContractFn") {
      const contractFn = xdrField<object>(fn, "contractFn")
      const contractAddress = Address.fromScAddress(xdrField(contractFn, "contractAddress")).toString()
      add({ tag: "CallContract", values: [contractAddress] })
    } else if (fnType?.startsWith("sorobanAuthorizedFunctionTypeCreateContract")) {
      const wasmHash = extractCreateContractWasmHash(fn)
      if (wasmHash) {
        add({ tag: "CreateContract", values: [wasmHash] })
      }
    }
    for (const sub of xdrField<xdr.SorobanAuthorizedInvocation[]>(invocation, "subInvocations")) {
      walk(sub)
    }
  }

  walk(xdrField(entry, "rootInvocation"))
  add({ tag: "Default", values: undefined })
  return types
}

function wasmHashOf(executable: xdr.ContractExecutable): Buffer | null {
  if (xdrType(executable) !== "contractExecutableWasm") return null
  return xdrBytes(xdrField(executable, "wasmHash"))
}

function extractCreateContractWasmHash(fn: xdr.SorobanAuthorizedFunction): Buffer | null {
  const fnType = xdrType(fn)
  if (fnType === "sorobanAuthorizedFunctionTypeCreateContractHostFn") {
    return wasmHashOf(xdrField(xdrField(fn, "createContractHostFn"), "executable"))
  }
  if (fnType === "sorobanAuthorizedFunctionTypeCreateContractV2HostFn") {
    return wasmHashOf(xdrField(xdrField(fn, "createContractV2HostFn"), "executable"))
  }
  return null
}
