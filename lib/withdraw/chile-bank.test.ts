import { describe, expect, it } from "vitest"
import {
  chileBankAccountReady,
  chileBankById,
  isChileAccountType,
  normalizeChileAccountNumber,
} from "@/lib/withdraw/chile-bank"

describe("chile bank account for withdraw", () => {
  it("needs bank, account type, account number, full name, and amount", () => {
    expect(
      chileBankAccountReady({
        holderName: "María Soto",
        bankId: "bancoestado",
        accountType: "corriente",
        account: "12.345-678",
        amount: "25,50",
      }),
    ).toEqual({
      ok: true,
      holderName: "María Soto",
      bank: "BancoEstado",
      bankId: "bancoestado",
      accountType: "corriente",
      account: "12345678",
      amount: "25.50",
    })
  })

  it("rejects a missing type or an unknown bank", () => {
    expect(
      chileBankAccountReady({
        holderName: "María Soto",
        bankId: "bancoestado",
        accountType: "",
        account: "12345678",
        amount: "10",
      }),
    ).toEqual({ ok: false })
    expect(chileBankById("missing")).toBeNull()
    expect(isChileAccountType("corriente")).toBe(true)
    expect(isChileAccountType("checking")).toBe(false)
    expect(normalizeChileAccountNumber(" 001-234 567 ")).toBe("001234567")
  })
})
