import { describe, expect, it } from "vitest"
import {
  decimalStringToMinor,
  i128ScValToBigInt,
  minorToDecimalString,
  minorToI128ScVal,
  parseMinorAmount,
} from "./amount"

describe("exact amounts", () => {
  it("formats minor units without float rounding", () => {
    expect(minorToDecimalString(BigInt("123456789"), 7)).toBe("12.3456789")
    expect(minorToDecimalString(BigInt("120000000"), 7)).toBe("12.00")
    expect(minorToDecimalString(BigInt("1"), 7)).toBe("0.0000001")
    expect(minorToDecimalString(BigInt("0"), 7)).toBe("0.00")
    // 2^53 + 1 stroops: not representable as a JS number.
    expect(minorToDecimalString(BigInt("9007199254740993"), 7)).toBe("900719925.4740993")
  })

  it("round-trips decimal strings exactly", () => {
    expect(decimalStringToMinor("12.3456789", 7)).toBe(BigInt("123456789"))
    expect(decimalStringToMinor("922337203685.4775807", 7)).toBe(BigInt("9223372036854775807"))
    expect(decimalStringToMinor("5", 7)).toBe(BigInt("50000000"))
    expect(decimalStringToMinor("1.00000001", 7)).toBeNull()
    expect(decimalStringToMinor("-1", 7)).toBeNull()
  })

  it("shows why parseFloat is unsafe for a full-balance send", () => {
    const balance = BigInt("9007199254740993")
    const viaFloat = BigInt(Math.round(parseFloat(minorToDecimalString(balance, 7)) * 1e7))
    expect(viaFloat).not.toBe(balance)
  })

  it("encodes and decodes i128 exactly, including above 2^64", () => {
    for (const v of ["1", "123456789", "9007199254740993", "18446744073709551617"]) {
      expect(i128ScValToBigInt(minorToI128ScVal(BigInt(v)))).toBe(BigInt(v))
    }
    expect(() => minorToI128ScVal(BigInt(0))).toThrow()
  })

  it("parses minor amounts from request bodies strictly", () => {
    expect(parseMinorAmount("123456789")).toBe(BigInt("123456789"))
    expect(parseMinorAmount("0")).toBe(BigInt(0))
    for (const bad of [123, "1.5", "-1", "01", "", null, "1e7"]) {
      expect(parseMinorAmount(bad), String(bad)).toBeNull()
    }
  })
})
