"use client"

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"

/** Centers a souvenir on the viewport, above the profile sheet. */
export function SouvenirPopup({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={label}
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function BadgePopup({
  name,
  drop,
  imagePath,
  onClose,
}: {
  name: string
  drop: string
  imagePath: string
  onClose: () => void
}) {
  return (
    <SouvenirPopup label={name} onClose={onClose}>
      <figure data-souvenir-popup="badge" className="overflow-hidden rounded-3xl bg-black text-center text-white">
        <img src={imagePath} alt={name} className="aspect-square w-full object-cover" />
        <figcaption className="px-4 py-4">
          <p className="text-lg font-semibold">{name}</p>
          <p className="text-sm text-white/50">{drop}</p>
        </figcaption>
      </figure>
    </SouvenirPopup>
  )
}
