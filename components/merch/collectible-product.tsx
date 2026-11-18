"use client"

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react"
import { productFormForName, type ProductForm } from "@/lib/merch/product-form"

const SWAY = "collectible-product-spin 7s ease-in-out infinite"

function Shirt() {
  return (
    <div className="relative h-44 w-40 [transform-style:preserve-3d]">
      <div className="absolute left-8 top-7 h-[7.5rem] w-24 rounded-b-[2rem] bg-[#f7f7f7] [transform:translateZ(10px)]" />
      <div className="absolute left-8 top-7 h-[7.5rem] w-24 rounded-b-[2rem] bg-[#e1e1e1] [transform:rotateY(180deg)_translateZ(10px)]" />
      <div className="absolute left-2 top-9 h-7 w-11 rounded-full bg-[#f4f4f4] [transform:translateZ(10px)]" />
      <div className="absolute right-2 top-9 h-7 w-11 rounded-full bg-[#ebebeb] [transform:translateZ(10px)]" />
      <div className="absolute left-1/2 top-7 h-4 w-8 -translate-x-1/2 rounded-b-full bg-[#d7d7d7] [transform:translateZ(12px)]" />
    </div>
  )
}

function Cap() {
  return (
    <div className="relative h-40 w-44 [transform-style:preserve-3d]">
      <div className="absolute left-8 top-4 h-20 w-28 rounded-t-[3rem] rounded-b-md bg-[#f4f4f4] [transform:translateZ(16px)]" />
      <div className="absolute left-8 top-4 h-20 w-28 rounded-t-[3rem] rounded-b-md bg-[#dcdcdc] [transform:rotateY(180deg)_translateZ(16px)]" />
      <div className="absolute left-8 top-8 h-14 w-4 bg-[#ececec] [transform:rotateY(-90deg)]" />
      <div className="absolute right-8 top-8 h-14 w-4 bg-[#d0d0d0] [transform:rotateY(90deg)]" />
      <div className="absolute left-6 top-[4.5rem] h-8 w-32 rounded-[100%] bg-[#1a1a1a] [transform:translateZ(18px)_rotateX(58deg)]" />
      <div className="absolute left-[4.4rem] top-6 h-16 w-px bg-black/15 [transform:translateZ(18px)]" />
      <div className="absolute left-[6.2rem] top-5 h-16 w-px bg-black/15 [transform:translateZ(18px)]" />
    </div>
  )
}

function Goods({ name }: { name: string }) {
  return (
    <div className="relative h-40 w-36 [transform-style:preserve-3d]">
      <div className="absolute inset-x-3 top-4 flex h-32 items-center justify-center rounded-2xl bg-[#f4f4f4] px-3 text-center text-sm font-semibold text-black [transform:translateZ(16px)]">
        {name}
      </div>
      <div className="absolute inset-x-3 top-4 h-32 rounded-2xl bg-[#d9d9d9] [transform:rotateY(180deg)_translateZ(16px)]" />
      <div className="absolute left-3 top-6 h-28 w-4 bg-[#e8e8e8] [transform:rotateY(-90deg)]" />
      <div className="absolute right-3 top-6 h-28 w-4 bg-[#cfcfcf] [transform:rotateY(90deg)]" />
      <div className="absolute inset-x-5 top-4 h-4 bg-[#ececec] [transform:rotateX(90deg)]" />
    </div>
  )
}

function ObjectStage({ form, name }: { form: ProductForm; name: string }) {
  if (form === "shirt") return <Shirt />
  if (form === "cap") return <Cap />
  return <Goods name={name} />
}

export function CollectibleProduct({ name }: { name: string }) {
  const form = productFormForName(name)
  const drag = useRef<{ id: number; x: number; angle: number } | null>(null)
  const [angle, setAngle] = useState<number | null>(null)
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduce(media.matches)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (reduce) return
    drag.current = { id: event.pointerId, x: event.clientX, angle: angle ?? -28 }
    setAngle(angle ?? -28)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current
    if (!active || active.id !== event.pointerId) return
    setAngle(active.angle + (event.clientX - active.x) * 0.55)
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id === event.pointerId) drag.current = null
  }

  const spinning = angle == null && !reduce
  const stage: ReactNode = <ObjectStage form={form} name={name} />

  return (
    <div className="mx-auto w-full max-w-[16rem]" data-product-stage={form}>
      <style>{`@keyframes collectible-product-spin{0%,100%{transform:rotateX(12deg) rotateY(-28deg)}50%{transform:rotateX(12deg) rotateY(28deg)}}@media (prefers-reduced-motion:reduce){[data-product-stage] [data-product-turn]{animation:none!important}}`}</style>
      <div className="relative mx-auto flex h-56 items-center justify-center [perspective:800px]">
        <div
          data-product-turn={spinning ? "spin" : "hold"}
          data-product={form}
          className="cursor-grab [transform-style:preserve-3d] active:cursor-grabbing"
          style={
            spinning
              ? { animation: SWAY }
              : { transform: `rotateX(12deg) rotateY(${angle ?? -28}deg)` }
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {stage}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-4 h-3 w-28 rounded-[100%] bg-black/80 blur-md"
        />
      </div>
      <p className="sr-only">{name}</p>
    </div>
  )
}
