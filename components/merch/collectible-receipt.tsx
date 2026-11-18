"use client"

import { CollectibleProduct } from "@/components/merch/collectible-product"
import type { CollectibleReceiptModel } from "@/lib/merch/receipt"
import { cn } from "@/lib/utils"

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

function shareText(model: CollectibleReceiptModel): string {
  return [model.itemName, model.editionLabel, `${model.price} ${model.currency}`, model.drop, model.timeLabel]
    .filter((line) => Boolean(line && line.trim()))
    .join("\n")
}

async function shareCollectible(model: CollectibleReceiptModel) {
  const text = shareText(model)
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title: model.itemName, text })
      return
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return
  }
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Share and clipboard can both be unavailable.
  }
}

export function CollectibleReceipt({
  model,
  embedded = false,
}: {
  model: CollectibleReceiptModel
  /** The surrounding popup already paints the card, so the receipt stays transparent. */
  embedded?: boolean
}) {
  return (
    <article
      className={cn(
        "relative isolate min-h-[22rem] overflow-hidden text-center text-white",
        embedded
          ? "bg-transparent"
          : "rounded-2xl border border-white/15 bg-black/90 p-4 backdrop-blur-md",
      )}
    >
      {model.imageUrl ? (
        <div className="relative z-10 mx-auto flex h-52 items-center justify-center">
          {/* Merchant photo, not a Next image: the file is served by the pay host. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={model.imageUrl}
            alt=""
            data-product-photo=""
            className="max-h-full max-w-[16rem] rounded-2xl object-contain"
          />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 flex h-[18rem] items-center justify-center">
          <div className="pointer-events-auto origin-center scale-125">
            <CollectibleProduct name={model.itemName} />
          </div>
        </div>
      )}
      <div
        className={cn(
          "pointer-events-none relative z-10 flex flex-col items-center justify-center gap-1 px-3",
          model.imageUrl ? "mt-3 text-white" : "h-[18rem] text-black",
        )}
      >
        <h2 className="text-xl font-semibold tracking-tight">{model.itemName}</h2>
        {model.editionLabel ? (
          <p className="text-sm font-medium" data-edition={model.editionLabel}>
            {model.editionLabel}
          </p>
        ) : null}
        <p className="text-sm font-medium">
          {model.price} {model.currency}
        </p>
        <p className="text-sm font-medium">{model.drop}</p>
        <p className="text-sm font-medium">{model.timeLabel}</p>
      </div>
      <button
        type="button"
        onClick={() => void shareCollectible(model)}
        className="relative z-10 mt-4 h-12 w-full rounded-xl border border-white/20 bg-white/10 text-base font-semibold text-white hover:bg-white/15"
      >
        {model.shareLabel}
      </button>
    </article>
  )
}
