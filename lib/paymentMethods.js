export const PAYMENT_METHODS = [
  {
    id: "wise_bank",
    label: "Wise / Bank Transfer",
    shortLabel: "Wise",
    recommended: true,
    description:
      "Recommended for US clients sending USD to a VA or agency local bank.",
  },
  {
    id: "remitly",
    label: "Remitly",
    shortLabel: "Remitly",
    recommended: false,
    description:
      "Good for US clients sending to Philippine bank, GCash, Maya, or cash pickup.",
  },
  {
    id: "stripe",
    label: "Card Payment",
    shortLabel: "Stripe",
    recommended: false,
    description:
      "Best for card payment, Apple Pay, Google Pay, or automated checkout.",
  },
  {
    id: "paypal",
    label: "PayPal",
    shortLabel: "PayPal",
    recommended: false,
    description: "Fallback option for international online payments.",
  },
  {
    id: "manual_bank",
    label: "Manual Bank Transfer",
    shortLabel: "Bank",
    recommended: false,
    description:
      "Client manually sends payment to the bank details provided.",
  },
];

export function getPaymentMethodLabel(method) {
  return PAYMENT_METHODS.find((item) => item.id === method)?.label || method;
}