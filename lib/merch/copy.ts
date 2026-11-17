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
  share: string
  paymentLink: string
  transferLink: string
  collections: string
  emptyCollections: string
  previousReceipt: string
  nextReceipt: string
  findNear: string
  findOpen: string
  back: string
  offered: string
  souvenirs: string
  openSouvenirs: string
  claimSouvenir: string
  claimWithWallet: string
  claimFailed: string
  emptySouvenirs: string
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
  share: "Compartir",
  paymentLink: "Pago",
  transferLink: "Coleccionable",
  collections: "Colecciones",
  emptyCollections: "Todavía no tienes coleccionables.",
  previousReceipt: "Anterior",
  nextReceipt: "Siguiente",
  findNear: "Cerca de ti",
  findOpen: "Ver",
  back: "Volver",
  offered: "En el evento",
  souvenirs: "Souvenirs coleccionables",
  openSouvenirs: "Ver souvenirs coleccionables",
  claimSouvenir: "Reclamar",
  claimWithWallet: "Firma con tu billetera",
  claimFailed: "No se pudo reclamar el souvenir.",
  emptySouvenirs: "Todavía no reclamaste ni compraste un souvenir.",
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
  share: "Share",
  paymentLink: "Payment",
  transferLink: "Collectible",
  collections: "Collections",
  emptyCollections: "You don't hold a collectible yet.",
  previousReceipt: "Previous",
  nextReceipt: "Next",
  findNear: "Near you",
  findOpen: "View",
  back: "Back",
  offered: "At the event",
  souvenirs: "Collectible souvenirs",
  openSouvenirs: "View collectible souvenirs",
  claimSouvenir: "Claim",
  claimWithWallet: "Sign with your wallet",
  claimFailed: "The souvenir could not be claimed.",
  emptySouvenirs: "You have not claimed or bought a souvenir yet.",
}

export function merchCopy(language: MerchLanguage): MerchCopy {
  return language === "en" ? en : es
}
