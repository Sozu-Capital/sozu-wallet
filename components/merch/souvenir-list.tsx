export type SouvenirListItem = {
  slug: string
  name: string
  drop: string
  imagePath: string
}

export function SouvenirList({
  label,
  items,
}: {
  label: string
  items: readonly SouvenirListItem[]
}) {
  return (
    <section aria-label={label} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.slug} className="list-none">
            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3">
              <img src={item.imagePath} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-white">{item.name}</p>
                <p className="truncate text-[12px] text-white/45">{item.drop}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
