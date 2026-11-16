/**
 * stellar-sdk 17 XDR unions expose the discriminant via `switch().name`
 * and each arm as a method. Older objects still use `.type` and properties.
 */

type XdrNode = {
  type?: unknown
  switch?: () => { name?: string } | number
  arm?: () => unknown
}

export function xdrType(value: XdrNode | null | undefined): string | undefined {
  if (!value) return undefined
  if (typeof value.switch === "function") {
    const switched = value.switch()
    if (switched && typeof switched === "object" && typeof switched.name === "string" && switched.name.length > 0) {
      return switched.name
    }
  }
  if (typeof value.arm === "function") {
    const arm = value.arm()
    if (typeof arm === "string" && arm.length > 0) return arm
  }
  return typeof value.type === "string" ? value.type : undefined
}

export function xdrField<T>(value: object, name: string): T {
  const field = (value as Record<string, unknown>)[name]
  if (typeof field === "function") return (field as () => T).call(value)
  return field as T
}

export function xdrBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "number") return BigInt(value)
  return BigInt(String(value))
}

/** Opaque XDR bytes. SDK 17 returns a Buffer; older builds exposed `.toBytes()`. */
export function xdrBytes(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (value && typeof value === "object" && "toBytes" in value) {
    const toBytes = (value as { toBytes?: unknown }).toBytes
    if (typeof toBytes === "function") return Buffer.from(toBytes.call(value) as Uint8Array)
  }
  throw new Error("expected XDR bytes")
}
