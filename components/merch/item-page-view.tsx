import type { ItemPageModel } from "@/lib/merch/item-page"

export function ItemPageView({ model }: { model: ItemPageModel }) {
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
      {model.soldOut ? (
        <p className="mt-6 text-sm font-medium text-white/80">{model.soldOutLabel}</p>
      ) : null}
      <button
        type="button"
        disabled={model.buyDisabled}
        className="mt-auto w-full rounded-full bg-white py-3.5 text-[13px] font-semibold text-black disabled:opacity-40"
      >
        {model.buyLabel}
      </button>
    </main>
  )
}
