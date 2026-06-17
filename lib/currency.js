export const CURRENCY_OPTIONS = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "PHP", label: "PHP — Philippine Peso" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "NZD", label: "NZD — New Zealand Dollar" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "INR", label: "INR — Indian Rupee" },
];

export function normalizeCurrency(currency) {
  return currency || "USD";
}

export function formatMoney(amount, currency = "USD") {
  const safeCurrency = normalizeCurrency(currency);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
    }).format(Number(amount || 0));
  } catch {
    return `${safeCurrency} ${Number(amount || 0).toFixed(2)}`;
  }
}

export function groupTotalsByCurrency(invoices = []) {
  return invoices.reduce((groups, invoice) => {
    const currency =
      invoice.currency || invoice.clients?.currency || invoice.client?.currency || "USD";

    const amount = Number(invoice.total_amount || 0);

    if (!groups[currency]) {
      groups[currency] = 0;
    }

    groups[currency] += amount;

    return groups;
  }, {});
}