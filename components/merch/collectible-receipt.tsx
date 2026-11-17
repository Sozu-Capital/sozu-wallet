import { CollectibleProduct } from "@/components/merch/collectible-product"
import type { CollectibleReceiptModel } from "@/lib/merch/receipt"

export function PurchaseLine({
  model,
  onOpen,
}: {
  model: CollectibleReceiptModel
  onOpen?: () => void
}) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center justify-between gap-3 text-left">
      <span>{model.line}</span>
      <span>
        {model.price} {model.currency}
      </span>
      <span>{model.statusLabel}</span>
    </button>
  )
}

export function CollectibleReceipt({ model }: { model: CollectibleReceiptModel }) {
  return (
    <article className="relative z-10 space-y-1 rounded-lg border border-white/15 bg-black p-4 text-center text-white">
      <CollectibleProduct name={model.itemName} />
      <h2 className="mt-1 text-xl font-semibold tracking-tight">{model.itemName}</h2>
      {model.editionLabel ? <p data-edition={model.editionLabel}>{model.editionLabel}</p> : null}
      <p>
        {model.price} {model.currency}
      </p>
      <p>{model.drop}</p>
      <p>{model.timeLabel}</p>
      <p>{model.networkLabel}</p>
      <p>{model.statusLabel}</p>
      {model.paymentUrl ? <a href={model.paymentUrl}>{model.paymentLink}</a> : null}
      {model.transferUrl ? <a href={model.transferUrl}>{model.transferLink}</a> : null}
      <p>{model.disclaimer}</p>
    </article>
  )
}
