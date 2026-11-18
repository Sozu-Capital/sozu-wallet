import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SouvenirList } from "@/components/merch/souvenir-list"

describe("profile souvenir list", () => {
  it("opens a bought collectible and a claimed badge, and offers an unclaimed badge to sign", () => {
    const html = renderToStaticMarkup(
      createElement(SouvenirList, {
        label: "Souvenirs coleccionables",
        items: [
          {
            id: "receipt:1",
            kind: "receipt",
            name: "T-shirt",
            drop: "UNBLCK",
            imageUrl: "https://dev.pay.sozu.capital/api/public/stores/org/items/tee/image",
          },
          {
            id: "badge:1",
            kind: "badge",
            name: "Collectible Souvenir",
            drop: "Liquid Society · 18 Nov 2026",
            imagePath: "/merch/liquid-society-souvenir.svg",
          },
          {
            id: "claim:1",
            kind: "claim",
            name: "Collectible Souvenir",
            drop: "Liquid Society · 18 Nov 2026",
            imagePath: "/merch/liquid-society-souvenir.svg",
            claimLabel: "Reclamar",
            signingLabel: "Firma con tu billetera",
          },
        ],
      }),
    )
    expect(html).toContain('aria-label="Souvenirs coleccionables"')
    expect(html).toContain('data-souvenir-kind="receipt"')
    expect(html).toContain('data-souvenir-preview="receipt"')
    expect(html).toContain('src="https://dev.pay.sozu.capital/api/public/stores/org/items/tee/image"')
    expect(html).not.toContain(">3D<")
    expect(html).toContain('data-souvenir-kind="badge"')
    expect(html).toContain('data-souvenir-kind="claim"')
    expect(html).toContain("Reclamar")
    expect(html).toContain("Firma con tu billetera")
    expect(html).toContain('src="/merch/liquid-society-souvenir.svg"')
  })
})
