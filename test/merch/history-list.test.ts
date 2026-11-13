import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { WalletActivityList } from "@/components/wallet/wallet-activity-list"
import type { WalletActivityItem } from "@/hooks/use-wallet-activity"

const items: WalletActivityItem[] = [
  {
    id: "deposit",
    sortAt: 3,
    kind: "chain",
    direction: "in",
    amountLabel: "+15.00 USDC",
    subtitle: "From $ada",
  },
  {
    id: "payment",
    sortAt: 2,
    kind: "chain",
    direction: "out",
    amountLabel: "−12.00 USDC",
    subtitle: "To $sozu",
  },
  {
    id: "withdraw",
    sortAt: 1,
    kind: "manual",
    direction: "out",
    amountLabel: "−5000 CLP",
    subtitle: "Cafe",
  },
]

describe("history list", () => {
  it("renders transfers, deposits, and withdrawals as simple rows and does not embed a collectible receipt", () => {
    const html = renderToStaticMarkup(
      createElement(WalletActivityList, {
        items,
        walletNetwork: "testnet",
        isLoading: false,
      }),
    )
    expect(html).toContain("+15.00 USDC")
    expect(html).toContain("From $ada")
    expect(html).toContain("−12.00 USDC")
    expect(html).toContain("To $sozu")
    expect(html).toContain("−5000 CLP")
    expect(html).toContain("Cafe")
    expect(html).not.toContain("Compra ·")
    expect(html).not.toContain("comprobante de compra")
    expect(html).not.toContain("<article")
  })
})
