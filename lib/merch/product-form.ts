/** The physical object drawn on a collectible receipt. Not a token. */
export type ProductForm = "shirt" | "cap" | "goods"

const SHIRT = /\b(t[-\s]?shirts?|tees?|shirts?|remeras?|poleras?|camisetas?|playeras?)\b/i
const CAP = /\b(5[-\s]?panels?|five[-\s]?panels?|gorras?|jockeys?|caps?|hats?)\b/i

/** Shirt and cap names use that object. Every other collectible uses a goods plinth labeled with the product. */
export function productFormForName(name: string): ProductForm {
  const value = name.trim()
  if (SHIRT.test(value)) return "shirt"
  if (CAP.test(value)) return "cap"
  return "goods"
}
