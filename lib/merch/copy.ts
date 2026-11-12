export type MerchLanguage = "es" | "en"

export type MerchCopy = {
  buy: (price: string) => string
  receiptLine: string
  testnet: string
  soldOut: string
}

const es: MerchCopy = {
  buy: (price) => `Comprar · ${price} USDC`,
  receiptLine: "Recibirás un coleccionable digital como comprobante de compra.",
  testnet: "Red de pruebas",
  soldOut: "Agotado",
}

const en: MerchCopy = {
  buy: (price) => `Buy · ${price} USDC`,
  receiptLine: "You will receive a digital collectible as your proof of purchase.",
  testnet: "Testnet",
  soldOut: "Sold out",
}

export function merchCopy(language: MerchLanguage): MerchCopy {
  return language === "en" ? en : es
}
