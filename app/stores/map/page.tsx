import type { Metadata } from "next"
import { StoreMap } from "@/components/stores/store-map"

export const metadata: Metadata = {
  title: "Pagar a un local — Sozu",
  description: "Encontrá un local en el mapa y pagá con Sozu.",
}

export default function StoresMapPage() {
  return <StoreMap />
}
