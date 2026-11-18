"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentConfetti } from "@/components/checkout/payment-confetti";
import type { PaymentReceipt } from "@/lib/payment/payment-receipt";
import { collectibleHomePath } from "@/lib/checkout/collectible-return";
import { hapticPaymentConfirmed } from "@/lib/haptics/web-haptics";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import { CollectibleReceipt } from "@/components/merch/collectible-receipt";
import type { CollectibleReceiptModel } from "@/lib/merch/receipt";

export function CheckoutSuccessScreen({
  merchantName,
  amountUsd,
  amountDisplay,
  itemName,
  assetLabel = "USD",
  showCashback = true,
  transactionHash,
  receipt: _receipt,
  collectible,
}: {
  merchantName: string;
  amountUsd?: string;
  amountDisplay?: string;
  itemName?: string | null;
  assetLabel?: string;
  showCashback?: boolean;
  transactionHash: string | null;
  receipt?: PaymentReceipt;
  collectible?: CollectibleReceiptModel | null;
}) {
  const router = useRouter();
  const celebrated = useRef(false);

  useEffect(() => {
    if (!collectible || celebrated.current) return;
    celebrated.current = true;
    hapticPaymentConfirmed();
  }, [collectible]);

  const handleDone = () => {
    router.push(collectible ? collectibleHomePath(transactionHash) : "/home");
  };

  if (collectible) {
    return (
      <BackgroundGradientAnimation
        firstColor="255, 100, 0"
        secondColor="255, 140, 0"
        thirdColor="255, 69, 0"
        fourthColor="0, 0, 0"
        fifthColor="255, 100, 0"
        size="80%"
        blendingValue="hard-light"
        interactive={false}
        containerClassName="min-h-screen"
      >
        <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 text-white">
          <PaymentConfetti />
          <div className="relative z-10 w-full max-w-md space-y-6">
            <CollectibleReceipt model={collectible} />
            {transactionHash ? (
              <div className="break-all px-2 text-center font-mono text-[11px] text-white/45">
                {transactionHash}
              </div>
            ) : null}
            <Button
              onClick={handleDone}
              className="w-full bg-white py-6 text-lg font-medium text-black hover:bg-white/90"
            >
              Done
            </Button>
          </div>
        </div>
      </BackgroundGradientAnimation>
    );
  }

  return (
    <BackgroundGradientAnimation
      firstColor="255, 100, 0"
      secondColor="255, 140, 0"
      thirdColor="255, 69, 0"
      fourthColor="0, 0, 0"
      fifthColor="255, 100, 0"
      size="80%"
      blendingValue="hard-light"
      interactive={false}
      containerClassName="min-h-screen"
    >
      <div className="flex min-h-screen flex-col items-center justify-center text-white p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/30 bg-white/10">
            <Check className="h-10 w-10 text-white" />
          </div>

          <div>
            <h1 className="mb-2 text-3xl font-bold text-white">Comprobante</h1>
            <p className="text-white/60">
              {itemName ? `${itemName} · pago confirmado` : "Pago confirmado"}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4">
              <div className="text-sm text-white/60">You paid</div>
              <div className="mt-1 text-3xl font-bold tabular-nums">
                {amountDisplay ?? (amountUsd != null ? `$${amountUsd}` : "")}
              </div>
              <div className="mt-1 text-sm text-white/60">
                {assetLabel === "USD" ? `to ${merchantName}` : `${assetLabel} to ${merchantName}`}
              </div>
            </div>

            {/* Cashback badge */}
            {showCashback && amountUsd ? (
              <div className="rounded-lg border border-white/30 bg-white/10 px-4 py-3 text-center">
                <div className="text-sm font-medium text-white">
                  You earned 3% cashback instantly
                </div>
                <div className="mt-1 text-xs text-white/60">
                  ${(parseFloat(amountUsd) * 0.03).toFixed(2)} USDC credited to your wallet
                </div>
              </div>
            ) : null}
          </div>

          {/* Transaction details */}
          {transactionHash && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-left">
              <div className="text-xs font-medium text-white/40 uppercase tracking-wide mb-2">
                Transaction
              </div>
              <div className="break-all text-xs font-mono text-white/60">
                {transactionHash}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handleDone}
              className="w-full bg-white text-black hover:bg-white/90 font-medium py-6 text-lg"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </BackgroundGradientAnimation>
  );
}
