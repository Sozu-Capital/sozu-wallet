import type React from "react"

export function PaperShaderBackgroundShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <div aria-hidden className="sozu-app-viewport sozu-app-viewport-bg pointer-events-none z-0">
        <div className="sozu-app-viewport-inner bg-black" />
      </div>
      {children}
    </>
  )
}
