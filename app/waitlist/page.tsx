import type { Metadata } from "next"
import { WaitlistScreen } from "@/components/waitlist/waitlist-screen"

export const metadata: Metadata = {
  title: "Sozu",
  description: "Early users get rewarded.",
}

export default function WaitlistPage() {
  return <WaitlistScreen />
}
