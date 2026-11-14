"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CollectibleReceipt } from "@/components/merch/collectible-receipt"
import { FindCollectibles, type FindCityDot, type FindCollectibleCard } from "@/components/merch/find-collectibles"
import { useHorizontalPanelSwipe } from "@/hooks/use-horizontal-panel-swipe"
import type { CollectibleReceiptModel } from "@/lib/merch/receipt"
import { stepReceipt } from "@/lib/merch/collections"
import { COMMIT_FRACTION, FLICK_PX_PER_MS } from "@/lib/shell/panel-motion"

export type CollectionCard = {
  slug: string
  receipt: CollectibleReceiptModel
}

export function CollectionsPanelView({
  title,
  nearLabel,
  cityLabel,
  findItems,
  cityDots,
  previousLabel,
  nextLabel,
  cards,
  activeIndex,
  onActiveIndexChange,
  onLeavePrevious,
}: {
  title: string
  nearLabel: string
  cityLabel: string
  findItems: FindCollectibleCard[]
  cityDots: FindCityDot[]
  previousLabel: string
  nextLabel: string
  cards: CollectionCard[]
  activeIndex?: number
  onActiveIndexChange?: (index: number) => void
  onLeavePrevious?: () => void
}) {
  const [uncontrolledIndex, setUncontrolledIndex] = useState(0)
  const controlled = activeIndex != null
  const index = cards.length === 0 ? 0 : Math.min(controlled ? activeIndex : uncontrolledIndex, cards.length - 1)
  const card = cards[index] ?? null
  const swipeable = cards.length > 1

  function move(direction: "next" | "previous", edge: "stay" | "leave") {
    const step = stepReceipt(index, cards.length, direction)
    if (step.leave) {
      if (edge === "leave") onLeavePrevious?.()
      return
    }
    if (step.index === index) return
    if (!controlled) setUncontrolledIndex(step.index)
    onActiveIndexChange?.(step.index)
  }

  const swipe = useHorizontalPanelSwipe({
    disabled: !swipeable,
    onDrag: () => {},
    onRelease: ({ dx, velocity }) => {
      const width = window.innerWidth || 1
      const distanceCommit = Math.abs(dx) >= width * COMMIT_FRACTION
      const flickCommit = Math.abs(velocity) >= FLICK_PX_PER_MS
      if (!distanceCommit && !flickCommit) return
      const signed = distanceCommit ? Math.sign(dx) : Math.sign(velocity)
      if (signed < 0) move("next", "leave")
      else if (signed > 0) move("previous", "leave")
    },
  })

  function capture<E extends { stopPropagation: () => void }>(handler: (event: E) => void) {
    return (event: E) => {
      if (swipeable) event.stopPropagation()
      handler(event)
    }
  }

  return (
    <section className="relative z-10 flex h-full flex-col overflow-y-auto px-6 pb-16 pt-8 text-white">
      <h1 className="text-xs font-medium uppercase tracking-[0.2em] text-white/50">{title}</h1>
      {card ? (
        <div
          className="mt-6"
          data-receipt-index={index}
          data-receipt-slug={card.slug}
          onTouchStart={capture(swipe.onTouchStart)}
          onTouchMove={capture(swipe.onTouchMove)}
          onTouchEnd={capture(swipe.onTouchEnd)}
          onMouseDown={capture(swipe.onMouseDown)}
          onMouseMove={capture(swipe.onMouseMove)}
          onMouseUp={capture(swipe.onMouseUp)}
          onMouseLeave={capture(swipe.onMouseLeave)}
        >
          <CollectibleReceipt model={card.receipt} />
          {swipeable ? (
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                aria-label={previousLabel}
                disabled={index === 0}
                onClick={() => move("previous", "stay")}
                className="inline-flex size-11 items-center justify-center rounded-full border border-white/15 text-white/80 disabled:opacity-30"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={nextLabel}
                disabled={index === cards.length - 1}
                onClick={() => move("next", "stay")}
                className="inline-flex size-11 items-center justify-center rounded-full border border-white/15 text-white/80 disabled:opacity-30"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <FindCollectibles nearLabel={nearLabel} cityLabel={cityLabel} items={findItems} dots={cityDots} />
      )}
    </section>
  )
}
