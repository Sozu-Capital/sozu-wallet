# Sozu — InstaWords script

Spoken words are the lines. Notes under each part are for the cut. They are not said on camera. Checked 7 November 2026.

How Sozu makes money is out of this video.

## Spoken script

Sozu is how a merchant gets paid faster and becomes their own bank.

Today, a customer pays and the money goes through a card machine, a card company, and the banks before it reaches you. That takes time, and even in your bank that money is not really yours to move. With Sozu, the customer pays from their phone: a link, a tap, a code, or standing next to you. You see the price in your currency. Dollars are in your account in under five seconds. You can earn on them, pay a supplier, or send them to your bank. Sozu is only the screen. The account is yours.

I used to sell card machines door to door, for a company that didn’t make it. That problem stayed with me. I had also sold online, and PayPal blocked my checkout. I’m Chilean, and I was living in Argentina. Inflation showed me what happens when people stop trusting the institutions that hold their money. Keeping cash yourself does not work day to day. When I sent money I had earned in Chile, a person-to-person transfer gave me almost twice what my bank would. That is when I started building. The problem is urgent everywhere. In some places you can see it. In others it is harder to see.

Sozu is two screens and one account. The merchant makes the charge in Sozu Pay. The customer pays it on their phone, with their face or fingerprint. The same dollars then show on the merchant’s screen. Sozu never holds the money.

This is one charge, on a test network, with test money. The merchant has a payment link. The customer opens it, sees the price, and approves with their phone. Their screen says the payment was sent, with the amount and a transaction number. In Sozu Pay, the merchant opens that same charge. The amount matches. The transaction matches. The dollars are in the merchant’s account.

I started building after that transfer. Hackathons showed me these products could exist. Working in the Stellar community showed me how to ship them. The account is dollars the merchant holds, because that is what the bank’s version got wrong. The price still shows in local currency, so the customer can do the math. Sozu is only the screen in front of that account.

What you just saw is test money, on a test network. The customer’s screen and the merchant’s screen show the same amount and the same transaction. Before this runs for real, we still have to rehearse this exact charge, and put both apps into production. After that, we publish the proof.

## What the camera shows

Film one payment link. Leave “Testnet · test funds” on screen for the whole charge.

1. The customer opens the link in Sozu Wallet and approves with a passkey (face or fingerprint).
2. Stop on “Payment sent”: amount, merchant name, transaction hash. Do not show the 3% cashback line.
3. Cut to Sozu Pay → transactions, receipt open for that same hash. Amount and hash match the customer’s screen.

The page that says “Payment received” and “funds will arrive shortly” is a customer redirect. It is not the merchant shot.

A link, a tap, a code, or standing next to you are all named in the thesis. Only the link is filmed. A tap is NFC. A code is QR, which Sozu Pay can generate for a charge. Standing next to you is proximity checkout, the Bluetooth mesh in the offline app (`capital.sozu.mesh`). A Sozu Tag (`$name`) is a quick way to pay a person. None of those three are this recording.

“Under five seconds” is the speech for dollars landing in the merchant’s account. It is the Stellar ledger time, about five seconds, not a timed take of this charge, and not the time to reach a bank. Sending dollars on to a bank or a supplier is a later move.

“You can earn on them” does not say a rate. The wallet falls back to 15.5 when no yield rate comes back. That number is not a yield. The November pilot also keeps earnings and APY off the peso label.

## Stack, and why each piece

Two apps, one charge.

| Piece | Where | Why it is there |
| --- | --- | --- |
| Sozu Wallet | `app.sozu.capital`, this repo, Next.js 16 | The customer’s phone. Passkey approval and the “Payment sent” screen. |
| Sozu Pay | `pay.sozu.capital`, Next.js 15 | The merchant’s screen. Creates the charge, stores it, and opens the receipt. |
| Payment link | Sozu Pay `POST /api/checkout/create`, then Wallet `/checkout/[id]` | The filmed path. The merchant sets the amount in dollars or in whole pesos. Pesos are priced into dollars on the server. The customer approves that amount. The customer does not invent it. |
| Passkey | WebAuthn on the phone | Face or fingerprint. The customer never sees a seed phrase. Sozu cannot spend the dollars without that signature. |
| Smart account | OpenZeppelin account, `smart-account-kit` on Sozu Pay | The on-chain account that holds the dollars. A merchant charge prefers the org treasury smart account, then a classic Stellar address. |
| Dollars | USDC on Stellar | Said as “dollars” on camera. USDC and “stablecoin” stay off the narration. |
| Stellar | Ledger close about every five seconds | The reason a charge can land in seconds, and the network the Stellar community work was about. |
| Supabase | Both apps | The charge, the org, and the receipt live here. The chain is the dollars. The database is the merchant’s list of charges. |
| Fee payer | Sozu’s server key | Pays the network fee so the merchant and customer do not have to. It cannot move their dollars. |
| Pollar | Sozu Pay staff login | How a merchant’s team signs in and how treasury permissions are set. It is not the customer’s passkey. |
| DeFindex and Blend | Wallet, testnet yield | The “earn on those dollars” path. Not part of the filmed charge. |
| Local price | CLP quote on the charge | “You see the price in your currency.” The dollars underneath stay dollars. |

Sozu is the screen. The dollars move from the customer’s account to the merchant’s treasury. After the phone approves, the wallet sends the transaction hash to Sozu Pay (`/api/checkout/complete`). Sozu Pay checks it on the network and the receipt can open.

## This sprint

Instawards November pilot, Mujeres 2000. Sozu Pay and Sozu Wallet. 1–30 November 2026. Today is 7 November, the first day of the proof window.

The video’s ending maps to three gates already on the plan:

1. Full testnet rehearsal of the real flows, due 8 November (plan item 17).
2. Both apps promoted to production on mainnet, due 9 November (item 18), after passkey onboarding on mainnet and that rehearsal.
3. Smoke test run 11 November, hashes published 12 November (item 19): receive, a payment between two people, cash-out, a forced timeout, and a dispute dry run.

The spoken ending names the rehearsal, production, and the published proof. It does not mention cash-out, the 17 November event, or a mainnet badge.

The wider sprint, not narrated: a cash desk for the Argentina workshop (14 November) and event (17 November), caps, a timeout refund, and a closeout package by 30 November. Critical path on the plan: desk path → timeout → rehearsal → production → published hashes. The plan’s mainnet key table was still unfilled in the doc. A blank row there is not a claim that the keys are missing in production.

Phase 1, due 6 November, was the build goal: the flows working on testnet, and the mainnet keys and fee payer existing. This recording does not treat that goal as already proven on camera.
