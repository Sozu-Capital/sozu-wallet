"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"

type Item = {
  slug: string
  name: string
  amountUsd: string
  collectibleReceipt?: boolean
  imageUrl?: string | null
}
type Profile = { id: string; name: string; items: Item[] }

export default function StoreProfilePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id
  const [store, setStore] = useState<Profile | null>(null)
  const [amount, setAmount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch(`/api/stores/${encodeURIComponent(id)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.store) {
          setError(typeof data.error === "string" ? data.error : "Local no encontrado")
          return
        }
        setStore(data.store as Profile)
      })
      .catch(() => setError("No se pudo abrir el local"))
  }, [id])

  const pay = async (body: { slug?: string; amountUsd?: string }) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/stores/${encodeURIComponent(id)}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || typeof data.checkoutId !== "string") {
        setError(typeof data.error === "string" ? data.error : "No se pudo iniciar el pago")
        setBusy(false)
        return
      }
      router.push(`/checkout/${data.checkoutId}`)
    } catch {
      setError("No se pudo iniciar el pago")
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16">
      <div className="mx-auto w-full max-w-md">
        <button type="button" onClick={() => router.push("/stores")} className="text-sm text-white/60">
          Locales
        </button>
        <h1 className="mt-4 text-2xl font-semibold">{store?.name ?? "Local"}</h1>
        <p className="mt-2 text-sm text-white/55">Elegí un producto o enviá el monto que quieras.</p>

        <h2 className="mt-8 text-xs font-medium uppercase tracking-[0.16em] text-white/40">En venta</h2>
        <ul className="mt-3 space-y-2">
          {(store?.items ?? []).map((item) => (
            <li key={item.slug}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void pay({ slug: item.slug })}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left disabled:opacity-50"
              >
                {item.imageUrl ? (
                  // Merchant photo, not a Next image: the file is served by the pay host.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{item.name}</span>
                  {item.collectibleReceipt ? (
                    <span className="mt-1 block text-xs font-normal text-white/50">Coleccionable</span>
                  ) : null}
                </span>
                <span className="tabular-nums text-white/80">${item.amountUsd}</span>
              </button>
            </li>
          ))}
        </ul>
        {store && store.items.length === 0 ? (
          <p className="mt-3 text-sm text-white/45">Este local todavía no publicó productos.</p>
        ) : null}

        <h2 className="mt-8 text-xs font-medium uppercase tracking-[0.16em] text-white/40">
          Enviar un monto
        </h2>
        <div className="mt-3 flex gap-2">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ""))}
            inputMode="decimal"
            placeholder="0.00"
            className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 outline-none placeholder:text-white/30"
          />
          <button
            type="button"
            disabled={busy || !amount.trim()}
            onClick={() => void pay({ amountUsd: amount.trim().replace(",", ".") })}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      </div>
    </main>
  )
}
