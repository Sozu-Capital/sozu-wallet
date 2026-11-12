import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PanelDots } from "@/components/mobile/panel-dots"
import { PANEL_NAMES } from "@/lib/shell/panels"

describe("panel dots", () => {
  it("shows a tappable Collections dot", () => {
    const html = renderToStaticMarkup(
      createElement(PanelDots, {
        names: PANEL_NAMES,
        active: 1,
        onSelect: () => {},
      }),
    )
    expect(html).toContain('aria-label="collections"')
    expect(html).toContain('aria-label="settings"')
    expect(html).toContain('aria-label="history"')
    expect(html).not.toContain("disabled")
  })
})
