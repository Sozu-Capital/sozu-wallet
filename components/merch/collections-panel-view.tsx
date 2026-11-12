import type { CollectibleReceiptModel } from "@/lib/merch/receipt"
import { CollectibleReceipt } from "@/components/merch/collectible-receipt"

export type CollectionCard = {
  slug: string
  name: string
  networkLabel: string
  receipt: CollectibleReceiptModel
}

export function CollectionsPanelView({
  title,
  emptyLabel,
  dropHref,
  dropLabel,
  cards,
  openSlug,
  onOpen,
}: {
  title: string
  emptyLabel: string
  dropHref: string
  dropLabel: string
  cards: CollectionCard[]
  openSlug?: string | null
  onOpen?: (slug: string) => void
}) {
  return (
    <section className="relative z-10 flex h-full flex-col overflow-y-auto px-6 pb-16 pt-8 text-white">
      <h1 className="text-xs font-medium uppercase tracking-[0.2em] text-white/50">{title}</h1>
      {cards.length === 0 ? (
        <div className="mt-10">
          <p>{emptyLabel}</p>
          <a href={dropHref} className="mt-3 inline-block underline underline-offset-4">
            {dropLabel}
          </a>
        </div>
      ) : (
        <ul className="mt-6 flex snap-x gap-4 overflow-x-auto">
          {cards.map((card) => (
            <li key={card.slug} className="w-64 shrink-0 snap-center list-none">
              <button type="button" onClick={() => onOpen?.(card.slug)} className="w-full text-left">
                <span className="block text-lg">{card.name}</span>
                <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-white/50">
                  {card.networkLabel}
                </span>
              </button>
              {openSlug === card.slug ? <CollectibleReceipt model={card.receipt} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
