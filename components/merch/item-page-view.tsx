import type { BuyGate } from "@/lib/merch/buy-gate"
import type { ItemPageModel } from "@/lib/merch/item-page"

const buyClass =
  "mt-auto flex w-full items-center justify-center rounded-full bg-white py-3.5 text-[13px] font-semibold text-black disabled:opacity-40"

const allowGate: BuyGate = { kind: "allow", buyDisabled: false, payment: null }

export function ItemPageView({
  model,
  gate = allowGate,
}: {
  model: ItemPageModel
  gate?: BuyGate
}) {
  const soldOut = model.soldOut
  const showShortfall = !soldOut && gate.kind === "shortfall"
  const showNetwork = !soldOut && gate.kind === "network"
  const buyDisabled = soldOut || gate.buyDisabled

  return (
    <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col bg-black px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
      <img
        src={model.imageUrl}
        alt={model.name}
        width={800}
        height={800}
        className="h-[42vh] max-h-80 w-full rounded-3xl object-cover"
      />
      <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.16em] text-white/50">
        {model.networkLabel}
      </p>
      <h1 className="mt-2 text-[2rem] font-semibold leading-none tracking-tight">{model.name}</h1>
      <p className="mt-3 text-lg text-white/90">{model.priceLabel}</p>
      <p className="mt-4 text-[15px] leading-relaxed text-white/60">{model.receiptLine}</p>
      {soldOut ? (
        <p className="mt-6 text-sm font-medium text-white/80">{model.soldOutLabel}</p>
      ) : null}
      {showShortfall ? (
        <p className="mt-6 text-sm font-medium text-white/80">{gate.shortfallLabel}</p>
      ) : null}
      {showNetwork ? (
        <p className="mt-6 text-sm font-medium text-white/80">{gate.networkLabel}</p>
      ) : null}
      {!soldOut && gate.kind === "authenticate" ? (
        <a href={gate.href} className={buyClass}>
          {model.buyLabel}
        </a>
      ) : (
        <button type="button" disabled={buyDisabled} className={buyClass}>
          {model.buyLabel}
        </button>
      )}
      {showShortfall ? (
        <a href={gate.depositHref} className="mt-3 text-center text-sm text-white/70 underline underline-offset-4">
          {gate.depositLabel}
        </a>
      ) : null}
    </main>
  )
}
