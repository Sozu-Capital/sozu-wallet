import { GlassBlogCard } from "@/components/ui/glass-blog-card-shadcnui"

export type FindCollectibleCard = {
  href: string
  name: string
  drop: string
  imageUrl: string
  priceLabel: string | null
  excerpt?: string
  tags?: string[]
  actionLabel?: string
}

export type FindCityDot = {
  id: string
  name: string
  href: string
  x: number
  y: number
}

export function FindCollectibles({
  nearLabel,
  cityLabel,
  items,
  dots,
}: {
  nearLabel: string
  cityLabel: string
  items: FindCollectibleCard[]
  dots: FindCityDot[]
}) {
  return (
    <div className="mt-8 flex flex-col gap-8">
      {items.length > 0 ? (
        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">{nearLabel}</h2>
          <ul className="dark mt-3 flex flex-col gap-4 text-foreground">
            {items.map((item) => (
              <li key={item.href} className="list-none">
                <GlassBlogCard
                  href={item.href}
                  title={item.name}
                  excerpt={item.excerpt ?? item.drop}
                  image={item.imageUrl}
                  tags={item.tags}
                  author={{ name: item.drop, avatar: item.imageUrl }}
                  readTime={item.priceLabel ?? undefined}
                  actionLabel={item.actionLabel}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dots.length > 0 ? (
        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
            <a href="/city" className="hover:text-white">
              {cityLabel}
            </a>
          </h2>
          <div className="relative mt-3 h-48 overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/[0.04]">
            {dots.map((dot) => (
              <a
                key={dot.id}
                href={dot.href}
                aria-label={dot.name}
                className="absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
              >
                <span className="size-2.5 rounded-full bg-amber-400 shadow-[0_0_0_7px_rgba(251,191,36,0.18)]" />
              </a>
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {dots.map((dot) => (
              <li key={dot.id} className="list-none">
                <a href={dot.href} className="text-sm text-white/70 underline-offset-4 hover:text-white hover:underline">
                  {dot.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
