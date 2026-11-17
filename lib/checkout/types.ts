export type CheckoutSessionStatus = "pending" | "completed" | "failed" | "expired";

export type CheckoutSession = {
  id: string;
  status: CheckoutSessionStatus;
  amountUsd: string;
  reference: string | null;
  merchantName: string;
  destinationStellarAddress: string;
  allowDebit: boolean;
  allowCredit: boolean;
  allowBankTransfer: boolean;
  createdAt: string;
  stellarTxHash?: string | null;
  completedPaymentMethod?: string | null;
  organizationId?: string | null;
  /** Product link with the merchant's collectible receipt toggle on. Drinks are never set. */
  collectibleReceipt?: boolean;
};

export type CheckoutPublicResponse = CheckoutSession;

export type CheckoutStatusResponse = {
  id: string;
  status: CheckoutSessionStatus;
  amountUsd: string;
  reference: string | null;
  createdAt: string;
  stellarTxHash?: string | null;
  completedPaymentMethod?: string | null;
};
