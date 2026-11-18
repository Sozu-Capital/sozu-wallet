export type StoreCard = { id: string; name: string }

/** Prefer an exact name. A single search hit is close enough when the names differ slightly. */
export function pickStore(name: string, stores: readonly StoreCard[]): StoreCard | null {
  const needle = name.trim().toLowerCase()
  if (!needle) return null
  const exact = stores.find((store) => store.name.trim().toLowerCase() === needle)
  if (exact) return exact
  return stores.length === 1 ? stores[0] : null
}
