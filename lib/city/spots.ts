export type TreasureSpot = {
  id: string
  name: string
  longitude: number
  latitude: number
  description?: string
  rewardLabel?: string
  redeemed?: boolean
}

export type CityDot = {
  id: string
  name: string
  href: string
  /** Percent from the left of the city field. */
  x: number
  /** Percent from the top of the city field. North is up. */
  y: number
}

/** Partner spots in Santiago. Coordinates from geocoding. */
export const CITY_SPOTS: readonly TreasureSpot[] = [
  {
    id: "1",
    name: "Pandevilla",
    longitude: -70.6481253,
    latitude: -33.4446721,
    description: "París 834, Santiago, Chile. Canjea tu tesoro aquí.",
    rewardLabel: "Pandevilla",
  },
  {
    id: "2",
    name: "Swe Store",
    longitude: -70.6512,
    latitude: -33.4419,
    description: "Agustinas 651, 8320195 Santiago. Canjea tu tesoro aquí.",
    rewardLabel: "Swe Store",
  },
  {
    id: "3",
    name: "Casawork",
    longitude: -70.6408018,
    latitude: -33.4380742,
    description: "Villavicencio 395, 8320129 Santiago, Región Metropolitana.",
    rewardLabel: "Casawork",
  },
  {
    id: "4",
    name: "Charlie Wok",
    longitude: -70.6454365,
    latitude: -33.4326041,
    description: "Bellavista 419, 8420488 Recoleta, Región Metropolitana.",
    rewardLabel: "Charlie Wok",
  },
]

const PAD = 22
const SPAN = 56

/** Place each spot in a small city field. North stays up. */
export function projectCityDots(spots: readonly TreasureSpot[]): CityDot[] {
  if (spots.length === 0) return []
  if (spots.length === 1) {
    const spot = spots[0]
    return [{ id: spot.id, name: spot.name, href: `/city/spot/${spot.id}`, x: 50, y: 50 }]
  }

  let minLng = spots[0].longitude
  let maxLng = spots[0].longitude
  let minLat = spots[0].latitude
  let maxLat = spots[0].latitude
  for (const spot of spots) {
    if (spot.longitude < minLng) minLng = spot.longitude
    if (spot.longitude > maxLng) maxLng = spot.longitude
    if (spot.latitude < minLat) minLat = spot.latitude
    if (spot.latitude > maxLat) maxLat = spot.latitude
  }
  const lngSpan = maxLng - minLng || 1
  const latSpan = maxLat - minLat || 1

  return spots.map((spot) => ({
    id: spot.id,
    name: spot.name,
    href: `/city/spot/${spot.id}`,
    x: PAD + SPAN * ((spot.longitude - minLng) / lngSpan),
    y: PAD + SPAN * ((maxLat - spot.latitude) / latSpan),
  }))
}
