"use client"

import { ArrowDownToLine, ArrowUpFromLine, Landmark, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatWalletText } from "@/lib/wallet-texts"
import { useWalletLanguage } from "@/lib/wallet-language"

const actionIconClass = cn(
  "flex h-16 w-16 items-center justify-center rounded-[1.35rem]",
  "border border-white/15 bg-white/[0.08] text-white",
  "shadow-[0_10px_28px_rgba(0,0,0,0.28)]",
  "transition-colors group-hover:bg-white/[0.14] group-active:scale-95",
)

export function UniversalCommandBar({
  className,
  onDepositClick,
  onWithdrawClick,
}: {
  className?: string
  onDepositClick?: () => void
  onWithdrawClick?: () => void
}) {
  const { t } = useWalletLanguage()

  const showComingSoon = (label: string) => {
    toast(t.comingSoon, {
      description: formatWalletText(t.comingSoonDesc, { label }),
    })
  }

  const actions = [
    { key: "deposit", label: t.cmdDeposit, icon: ArrowDownToLine, onClick: onDepositClick },
    { key: "withdraw", label: t.cmdWithdraw, icon: ArrowUpFromLine, onClick: onWithdrawClick },
    { key: "credit", label: t.cmdCredit, icon: Landmark, onClick: () => showComingSoon(t.cmdCredit) },
    { key: "savings", label: t.cmdSavings, icon: TrendingUp, onClick: () => showComingSoon(t.cmdSavings) },
  ] as const

  return (
    <div className={cn("grid w-full grid-cols-4", className)}>
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            className="group flex min-w-0 flex-col items-center gap-2.5"
          >
            <span className={actionIconClass}>
              <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="max-w-full text-center text-[12px] font-medium leading-tight text-white/85">
              {action.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
