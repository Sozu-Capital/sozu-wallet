function editionInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

/** "6/10" when both numbers are a real shirt in the run. */
export function editionMark(
  number: number | null | undefined,
  size: number | null | undefined,
): string | null {
  if (typeof number !== "number" || typeof size !== "number") return null
  if (!Number.isInteger(number) || !Number.isInteger(size)) return null
  if (number < 1 || size < 1 || number > size) return null
  return `${number}/${size}`
}

/** Accepts 6 and "6". A partial pair is ignored. */
export function coerceEdition(
  number: unknown,
  size: unknown,
): { number: number; size: number } | null {
  const parsedNumber = editionInt(number)
  const parsedSize = editionInt(size)
  if (!editionMark(parsedNumber, parsedSize) || parsedNumber == null || parsedSize == null) return null
  return { number: parsedNumber, size: parsedSize }
}

/** "T-shirt 1/10" keeps the product name and the run. "1/10" alone is not a name. */
export function editionFromName(
  name: string,
): { name: string; number: number; size: number } | null {
  const match = name.trim().match(/^(.*?)(?:\s+)(\d+)\s*\/\s*(\d+)\s*$/)
  if (!match) return null
  const edition = coerceEdition(match[2], match[3])
  const itemName = match[1]?.trim() ?? ""
  if (!edition || !itemName) return null
  return { name: itemName, number: edition.number, size: edition.size }
}

/** Drops a trailing " 6/10" so the card can show the number on its own line. */
export function itemNameWithoutEdition(name: string, mark: string | null): string {
  const trimmed = name.trim()
  if (!mark) return trimmed
  const suffix = ` ${mark}`
  return trimmed.endsWith(suffix) ? trimmed.slice(0, -suffix.length) : trimmed
}
