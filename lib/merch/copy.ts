export type MerchLanguage = "es" | "en"

export type MerchCopy = {
  buy: (price: string) => string
  receiptLine: string
  testnet: string
  soldOut: string
  shortfall: (amount: string) => string
  deposit: string
  networkMismatch: string
}

const es: MerchCopy = {
  buy: (price) => `Comprar · ${price} USDC`,
  receiptLine: "Recibirás un coleccionable digital como comprobante de compra.",
  testnet: "Red de pruebas",
  soldOut: "Agotado",
  shortfall: (amount) => `Faltan ${amount} USDC`,
  deposit: "Depositar",
  networkMismatch: "La red de tu billetera no coincide.",
}

const en: MerchCopy = {
  buy: (price) => `Buy · ${price} USDC`,
  receiptLine: "You will receive a digital collectible as your proof of purchase.",
  testnet: "Testnet",
  soldOut: "Sold out",
  shortfall: (amount) => `Short ${amount} USDC`,
  deposit: "Deposit",
  networkMismatch: "Your wallet is on a different network.",
}

export function merchCopy(language: MerchLanguage): MerchCopy {
  return language === "en" ? en : es
}
