export function PanelDots({
  names,
  active,
  onSelect,
}: {
  names: readonly string[]
  active: number
  onSelect: (index: number) => void
}) {
  return (
    <nav
      aria-label="Wallet panels"
      className="absolute bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5"
    >
      {names.map((name, i) => {
        const selected = i === active
        return (
          <button
            key={name}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={name}
            aria-current={selected ? "page" : undefined}
            className="flex h-5 w-5 items-center justify-center"
          >
            <span
              className={`block h-1 rounded-full transition-all duration-300 ${
                selected ? "w-5 bg-white/70" : "w-1 bg-white/25"
              }`}
            />
          </button>
        )
      })}
    </nav>
  )
}
