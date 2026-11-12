export type MerchLanguage = "es" | "en"

export type MerchCopy = {
  buy: (price: string) => string
  receiptLine: string
  testnet: string
  soldOut: string
  shortfall: (amount: string) => string
  deposit: string
  networkMismatch: string
  receiptPending: string
  completed: string
  purchase: (item: string) => string
  statusPending: string
  statusFailed: string
  disclaimer: string
  paymentLink: string
  transferLink: string
}

const es: MerchCopy = {
  buy: (price) => `Comprar · ${price} USDC`,
  receiptLine: "Recibirás un coleccionable digital como comprobante de compra.",
  testnet: "Red de pruebas",
  soldOut: "Agotado",
  shortfall: (amount) => `Faltan ${amount} USDC`,
  deposit: "Depositar",
  networkMismatch: "La red de tu billetera no coincide.",
  receiptPending: "Comprobante en camino",
  completed: "Completada",
  purchase: (item) => `Compra · ${item}`,
  statusPending: "Pendiente",
  statusFailed: "Fallida",
  disclaimer: "Este coleccionable es un comprobante de compra. No es una inversión ni representa fondos.",
  paymentLink: "Pago",
  transferLink: "Coleccionable",
}

const en: MerchCopy = {
  buy: (price) => `Buy · ${price} USDC`,
  receiptLine: "You will receive a digital collectible as your proof of purchase.",
  testnet: "Testnet",
  soldOut: "Sold out",
  shortfall: (amount) => `Short ${amount} USDC`,
  deposit: "Deposit",
  networkMismatch: "Your wallet is on a different network.",
  receiptPending: "Receipt pending",
  completed: "Completed",
  purchase: (item) => `Purchase · ${item}`,
  statusPending: "Pending",
  statusFailed: "Failed",
  disclaimer: "This collectible is a proof of purchase. It is not an investment and does not represent funds.",
  paymentLink: "Payment",
  transferLink: "Collectible",
}

export function merchCopy(language: MerchLanguage): MerchCopy {
  return language === "en" ? en : es
}
