import { Suspense } from "react"
import { AppBootstrapGate } from "@/components/app-bootstrap-gate"
import { MobileAppShell } from "@/components/mobile/mobile-app-shell"
import { PizzaHopResume } from "@/components/pizza/PizzaHopResume"
import { isPilotMainnet } from "@/lib/pilot/pilot-mainnet"

export default function HomePage() {
  return (
    <AppBootstrapGate>
      {!isPilotMainnet() && <PizzaHopResume />}
      <Suspense>
        <MobileAppShell />
      </Suspense>
    </AppBootstrapGate>
  )
}
