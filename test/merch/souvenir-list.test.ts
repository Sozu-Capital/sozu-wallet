import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SouvenirList } from "@/components/merch/souvenir-list"
import { listCollectibleSouvenirs } from "@/lib/merch/catalog"

describe("profile souvenir list", () => {
  it("lists the Liquid Society collectible souvenir", () => {
    const html = renderToStaticMarkup(
      createElement(SouvenirList, {
        label: "Souvenirs coleccionables",
        items: listCollectibleSouvenirs(),
      }),
    )
    expect(html).toContain('aria-label="Souvenirs coleccionables"')
    expect(html).toContain("Collectible Souvenir")
    expect(html).toContain("Liquid Society · 18 Nov 2026")
    expect(html).toContain('src="/merch/liquid-society-souvenir.svg"')
  })
})
