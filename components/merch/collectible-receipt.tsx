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
    <article className="relative z-10 rounded-lg border border-white/15 bg-black p-4 text-white">
      <h2>{model.itemName}</h2>
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
