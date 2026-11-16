import { cn } from "@/lib/utils"

type ProgressPillsProps = {
  count: number
  current: number
  label?: string
  className?: string
}

export function ProgressPills({ count, current, label, className }: ProgressPillsProps) {
  const step = Math.min(count, Math.max(1, current + 1))

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={count}
        aria-valuenow={step}
        aria-valuetext={label}
        className="flex items-center gap-1.5"
      >
        {Array.from({ length: count }, (_, index) => (
          <span
            key={index}
            aria-hidden
            className={cn(
              "h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out motion-reduce:transition-none",
              index === current
                ? "w-[22px] bg-[var(--sozu-ember)] shadow-[0_0_10px_rgba(224,96,58,0.55)]"
                : "w-1.5 bg-[#3D3B36]",
            )}
          />
        ))}
      </div>
      {label ? (
        <p className="sozu-mono mt-[9px] text-[9.5px] font-medium uppercase leading-3 tracking-[0.14em] text-[var(--sozu-text-subtle)]">
          {label}
        </p>
      ) : null}
    </div>
  )
}
