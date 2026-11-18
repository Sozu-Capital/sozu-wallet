"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Loader2, Search, Store } from "lucide-react"
import { Map, MapControls, MapMarker, MarkerContent, MarkerPopup } from "@/components/ui/map"
import { CITY_SPOTS } from "@/lib/city/spots"
import { WalletLanguageProvider, useWalletLanguage } from "@/lib/wallet-language"
import { pickStore, type StoreCard } from "@/lib/stores/match"
import { cn } from "@/lib/utils"

const SANTIAGO_CENTER: [number, number] = [-70.6483, -33.4489]
const DEFAULT_ZOOM = 14

function placeLine(description?: string) {
  if (!description) return ""
  return description.replace(/\s*Canjea tu tesoro aquí\.?/gi, "").trim()
}

const COPY = {
  es: {
    title: "Pagar a un local",
    body: "Elegí un local en el mapa.",
    pay: "Pagar aquí",
    opening: "Abriendo…",
    search: "Buscar por nombre",
    back: "Inicio",
  },
  en: {
    title: "Pay a store",
    body: "Pick a store on the map.",
    pay: "Pay here",
    opening: "Opening…",
    search: "Search by name",
    back: "Home",
  },
} as const

export function StoreMap() {
  return (
    <WalletLanguageProvider>
      <StoreMapView />
    </WalletLanguageProvider>
  )
}

function StoreMapView() {
  const router = useRouter()
  const { language } = useWalletLanguage()
  const t = COPY[language === "en" ? "en" : "es"]
  const [center, setCenter] = useState<[number, number]>(SANTIAGO_CENTER)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const handleLocate = useCallback((coords: { longitude: number; latitude: number }) => {
    setCenter([coords.longitude, coords.latitude])
    setZoom(15)
  }, [])

  const payStore = useCallback(
    async (spotId: string, name: string) => {
      if (openingId) return
      setOpeningId(spotId)
      const query = encodeURIComponent(name)
      try {
        const res = await fetch(`/api/stores?q=${query}`)
        const data = (await res.json().catch(() => ({ stores: [] }))) as { stores?: StoreCard[] }
        const match = pickStore(name, Array.isArray(data.stores) ? data.stores : [])
        router.push(match ? `/stores/${match.id}` : `/stores?q=${query}`)
      } catch {
        router.push(`/stores?q=${query}`)
      }
    },
    [openingId, router],
  )

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      <div className="pointer-events-none absolute left-4 right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex items-start justify-between gap-3">
        <div className="pointer-events-auto min-w-0 rounded-2xl border border-white/10 bg-black/80 px-3 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Link
              href="/home"
              aria-label={t.back}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight">{t.title}</h1>
              <p className="text-xs text-white/55">{t.body}</p>
            </div>
          </div>
        </div>
        <Link
          href="/stores"
          className="pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/80 text-white backdrop-blur-xl"
          aria-label={t.search}
        >
          <Search className="size-4" />
        </Link>
      </div>

      <div className="relative min-h-0 flex-1">
        <Map
          theme="dark"
          className="absolute inset-0 h-full w-full"
          styles={{
            dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
            light: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
          }}
          viewport={{ center, zoom }}
          onViewportChange={(vp) => {
            if (vp.center) setCenter(vp.center)
            if (vp.zoom != null) setZoom(vp.zoom)
          }}
        >
          <MapControls
            position="bottom-right"
            showZoom
            showLocate
            onLocate={handleLocate}
            className="bottom-[max(1.25rem,env(safe-area-inset-bottom))]"
          />

          {CITY_SPOTS.map((spot) => (
            <MapMarker key={spot.id} longitude={spot.longitude} latitude={spot.latitude}>
              <MarkerContent>
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full border border-white/80 bg-black shadow-[0_0_18px_rgba(255,255,255,0.35)]",
                    openingId === spot.id && "opacity-60",
                  )}
                >
                  <Store className="size-4 text-white" />
                </span>
              </MarkerContent>
              <MarkerPopup closeButton className="min-w-[210px] p-0">
                <div className="p-3">
                  <h3 className="font-semibold">{spot.name}</h3>
                  {placeLine(spot.description) ? (
                    <p className="mt-1 text-sm text-muted-foreground">{placeLine(spot.description)}</p>
                  ) : null}
                  <button
                    type="button"
                    disabled={openingId !== null}
                    onClick={() => void payStore(spot.id, spot.name)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    {openingId === spot.id ? <Loader2 className="size-4 animate-spin" /> : null}
                    {openingId === spot.id ? t.opening : t.pay}
                  </button>
                </div>
              </MarkerPopup>
            </MapMarker>
          ))}
        </Map>
      </div>
    </div>
  )
}
