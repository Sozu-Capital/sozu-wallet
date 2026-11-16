"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

type StoreCard = { id: string; name: string }

export default function StoresSearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [stores, setStores] = useState<StoreCard[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setStores([])
      setError(null)
      return
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/stores?q=${encodeURIComponent(q)}`)
        .then(async (res) => {
          const data = await res.json().catch(() => ({ stores: [] }))
          if (!res.ok) {
            setError(typeof data.error === "string" ? data.error : "No se pudo buscar")
            setStores([])
            return
          }
          setError(null)
          setStores(Array.isArray(data.stores) ? data.stores : [])
        })
        .catch(() => setError("No se pudo buscar"))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query])

  return (
    <main className="min-h-screen bg-black text-white px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16">
      <div className="mx-auto w-full max-w-md">
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="text-sm text-white/60"
        >
          Volver
        </button>
        <h1 className="mt-4 text-2xl font-semibold">Pagar a un local</h1>
        <p className="mt-2 text-sm text-white/55">
          Buscá la tienda por nombre. Podés elegir algo en venta o enviar un monto.
        </p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre del local"
          className="mt-6 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base outline-none placeholder:text-white/30"
          autoFocus
        />
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        <ul className="mt-4 space-y-2">
          {stores.map((store) => (
            <li key={store.id}>
              <Link
                href={`/stores/${store.id}`}
                className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[15px] font-medium"
              >
                {store.name}
              </Link>
            </li>
          ))}
        </ul>
        {query.trim().length >= 2 && stores.length === 0 && !error ? (
          <p className="mt-4 text-sm text-white/45">Ningún local con ese nombre.</p>
        ) : null}
      </div>
    </main>
  )
}
