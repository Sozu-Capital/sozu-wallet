import type { ReactNode } from "react"

export type SouvenirListItem =
  | { id: string; kind: "receipt"; name: string; drop: string; imageUrl?: string | null }
  | { id: string; kind: "badge"; name: string; drop: string; imagePath: string }
  | { id: string; kind: "claim"; name: string; drop: string; imagePath: string; claimLabel: string; signingLabel: string }

export function SouvenirList({
  label,
  items,
  emptyLabel,
  onSelect,
  claimingId,
}: {
  label: string
  items: readonly SouvenirListItem[]
  emptyLabel?: string
  onSelect?: (id: string) => void
  claimingId?: string | null
}) {
  return (
    <section aria-label={label} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {items.length === 0 && emptyLabel ? (
        <p className="px-1 text-sm text-white/45">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const busy = claimingId === item.id
            return (
              <li key={item.id} className="list-none">
                <button
                  type="button"
                  data-souvenir-kind={item.kind}
                  disabled={busy}
                  onClick={() => onSelect?.(item.id)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.06] p-3 text-left disabled:opacity-60"
                >
                  <SouvenirMark item={item} />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-white">{item.name}</p>
                    <p className="truncate text-[12px] text-white/45">
                      {item.kind === "claim" ? item.signingLabel : item.drop}
                    </p>
                  </div>
                  {item.kind === "claim" ? (
                    <span className="ml-auto shrink-0 text-[12px] font-semibold text-white">{item.claimLabel}</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function SouvenirMark({ item }: { item: SouvenirListItem }): ReactNode {
  const photo = item.kind === "receipt" ? item.imageUrl : item.imagePath
  if (photo) {
    return (
      // Merchant photo, not a Next image: SozuPay may serve a data URL or another host.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        data-souvenir-preview={item.kind}
        className="h-14 w-14 shrink-0 rounded-xl object-cover"
      />
    )
  }
  return (
    <span
      data-souvenir-preview={item.kind}
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70"
    >
      {item.name.slice(0, 2).toUpperCase()}
    </span>
  )
}
