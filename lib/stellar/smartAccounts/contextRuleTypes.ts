import { Address, xdr } from "@stellar/stellar-sdk"

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
    const fn = invocation.function
    if (fn.type === "sorobanAuthorizedFunctionTypeContractFn") {
      const contractAddress = Address.fromScAddress(fn.contractFn.contractAddress).toString()
      add({ tag: "CallContract", values: [contractAddress] })
    } else if (fn.type.startsWith("sorobanAuthorizedFunctionTypeCreateContract")) {
      const wasmHash = extractCreateContractWasmHash(fn)
      if (wasmHash) {
        add({ tag: "CreateContract", values: [wasmHash] })
      }
    }
    for (const sub of invocation.subInvocations) {
      walk(sub)
    }
  }

  walk(entry.rootInvocation)
  add({ tag: "Default", values: undefined })
  return types
}

function wasmHashOf(executable: xdr.ContractExecutable): Buffer | null {
  if (executable.type !== "contractExecutableWasm") return null
  return Buffer.from(executable.wasmHash.toBytes())
}

function extractCreateContractWasmHash(fn: xdr.SorobanAuthorizedFunction): Buffer | null {
  if (fn.type === "sorobanAuthorizedFunctionTypeCreateContractHostFn") {
    return wasmHashOf(fn.createContractHostFn.executable)
  }
  if (fn.type === "sorobanAuthorizedFunctionTypeCreateContractV2HostFn") {
    return wasmHashOf(fn.createContractV2HostFn.executable)
  }
  return null
}
