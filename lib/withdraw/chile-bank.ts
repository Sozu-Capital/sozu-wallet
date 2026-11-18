export const CHILE_ACCOUNT_TYPES = ["corriente", "vista", "ahorro", "rut"] as const
export type ChileAccountType = (typeof CHILE_ACCOUNT_TYPES)[number]

export const CHILE_BANKS = [
  { id: "banco-de-chile", name: "Banco de Chile" },
  { id: "bancoestado", name: "BancoEstado" },
  { id: "santander", name: "Santander" },
  { id: "bci", name: "BCI" },
  { id: "itau", name: "Itaú" },
  { id: "scotiabank", name: "Scotiabank" },
  { id: "falabella", name: "Banco Falabella" },
  { id: "security", name: "Banco Security" },
  { id: "bice", name: "Banco BICE" },
  { id: "consorcio", name: "Banco Consorcio" },
  { id: "ripley", name: "Banco Ripley" },
  { id: "internacional", name: "Banco Internacional" },
  { id: "coopeuch", name: "Coopeuch" },
  { id: "tenpo", name: "Tenpo" },
] as const

export type ChileBankId = (typeof CHILE_BANKS)[number]["id"]

export function chileBankById(id: string): (typeof CHILE_BANKS)[number] | null {
  return CHILE_BANKS.find((bank) => bank.id === id) ?? null
}

export function isChileAccountType(value: string): value is ChileAccountType {
  return (CHILE_ACCOUNT_TYPES as readonly string[]).includes(value)
}

export function normalizeChileAccountNumber(raw: string): string {
  return raw.replace(/[\s.-]/g, "")
}

export function chileBankAccountReady(input: {
  holderName: string
  bankId: string
  accountType: string
  account: string
  amount: string
}):
  | {
      ok: true
      holderName: string
      bank: string
      bankId: ChileBankId
      accountType: ChileAccountType
      account: string
      amount: string
    }
  | { ok: false } {
  const holderName = input.holderName.trim()
  const bank = chileBankById(input.bankId.trim())
  const accountType = input.accountType.trim()
  const account = normalizeChileAccountNumber(input.account)
  const parsed = Number(input.amount.replace(",", "."))
  if (
    holderName.length < 3 ||
    !bank ||
    !isChileAccountType(accountType) ||
    account.length < 5 ||
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return { ok: false }
  }
  return {
    ok: true,
    holderName,
    bank: bank.name,
    bankId: bank.id,
    accountType,
    account,
    amount: parsed.toFixed(2),
  }
}
