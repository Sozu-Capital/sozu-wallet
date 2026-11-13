import { nativeToScVal, xdr } from "@stellar/stellar-sdk"

/** Exact token amounts in minor units (stroops for 7-decimal USDC). Never goes through floats. */

const I128_MAX = (BigInt(1) << BigInt(127)) - BigInt(1)

/** Accepts a non-negative integer string; returns null for anything else. */
export function parseMinorAmount(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) return null
  const n = BigInt(value)
  return n <= I128_MAX ? n : null
}

/** 123456789n, 7 → "12.3456789"; trailing zeros trimmed down to `minFractionDigits`. */
export function minorToDecimalString(minor: bigint, decimals: number, minFractionDigits = 2): string {
  if (minor < BigInt(0)) throw new Error("Negative amount")
  const s = minor.toString().padStart(decimals + 1, "0")
  const whole = s.slice(0, s.length - decimals)
  let fraction = decimals > 0 ? s.slice(s.length - decimals) : ""
  const keep = Math.min(minFractionDigits, decimals)
  while (fraction.length > keep && fraction.endsWith("0")) fraction = fraction.slice(0, -1)
  return fraction ? `${whole}.${fraction}` : whole
}

/** Exact decimal string → minor units. Rejects more fractional digits than the token has. */
export function decimalStringToMinor(value: string, decimals: number): bigint | null {
  const t = value.trim()
  const m = /^(\d+)(?:\.(\d+))?$/.exec(t)
  if (!m) return null
  const fraction = m[2] ?? ""
  if (fraction.length > decimals) return null
  return BigInt(m[1] + fraction.padEnd(decimals, "0"))
}

export function minorToI128ScVal(minor: bigint): xdr.ScVal {
  if (minor <= BigInt(0) || minor > I128_MAX) throw new Error(`Invalid transfer amount: ${minor}`)
  return nativeToScVal(minor, { type: "i128" })
}

export function i128ScValToBigInt(val: xdr.ScVal): bigint {
  if (val.type !== "scvI128") throw new Error("expected i128 amount")
  const hi = BigInt.asIntN(64, val.i128.hi)
  const lo = BigInt.asUintN(64, val.i128.lo)
  return (hi << BigInt(64)) + lo
}
