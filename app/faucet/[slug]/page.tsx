import { notFound } from "next/navigation"

/** The public slug is not an entry. NFC and QR use /tap#secret. */
export default function FaucetPage() {
  notFound()
}
