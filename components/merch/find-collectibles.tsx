import { GlassBlogCard } from "@/components/ui/glass-blog-card-shadcnui"

export type FindCollectibleCard = {
  id?: string
  href?: string
  name: string
  drop: string
  imageUrl: string
  priceLabel: string | null
  excerpt?: string
  tags?: string[]
  actionLabel?: string
  onSelect?: () => void
}

export function FindCollectibles({
  nearLabel,
  items,
}: {
  nearLabel: string
  items: FindCollectibleCard[]
}) {
  return (
    <div className="mt-8 flex flex-col gap-8">
      {items.length > 0 ? (
        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">{nearLabel}</h2>
          <ul className="dark mt-3 flex flex-col gap-4 text-foreground">
            {items.map((item) => {
              const card = (
                <GlassBlogCard
                  href={item.onSelect ? undefined : item.href}
                  title={item.name}
                  excerpt={item.excerpt ?? item.drop}
                  image={item.imageUrl}
                  tags={item.tags}
                  author={{ name: item.drop, avatar: item.imageUrl }}
                  readTime={item.priceLabel ?? undefined}
                  actionLabel={item.actionLabel}
                />
              )
              return (
                <li key={item.id ?? item.href} className="list-none">
                  {item.onSelect ? (
                    <button
                      type="button"
                      onClick={item.onSelect}
                      data-activation={item.id}
                      className="block w-full cursor-pointer text-left"
                    >
                      {card}
                    </button>
                  ) : (
                    card
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
