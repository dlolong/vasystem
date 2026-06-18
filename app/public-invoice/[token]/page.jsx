"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  Printer,
  ReceiptText,
} from "lucide-react";
import { PAYMENT_METHODS, getPaymentMethodLabel } from "@/lib/paymentMethods";

export default function PublicInvoicePage() {
  const params = useParams();
  const token = params?.token;

  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [paymentProfile, setPaymentProfile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedMethod, setSelectedMethod] = useState("wise_bank");
  const [submitting, setSubmitting] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    sender_name: "",
    sender_email: "",
    reference_number: "",
    receipt_url: "",
    notes: "",
  });

  useEffect(() => {
    if (!token) return;

    loadInvoice(token);
  }, [token]);

  useEffect(() => {
    if (paymentProfile?.preferred_method) {
      setSelectedMethod(paymentProfile.preferred_method);
    }
  }, [paymentProfile?.preferred_method]);

  const currency = invoice?.currency || invoice?.client?.currency || "USD";

  const availableMethods = useMemo(() => {
    const profile = paymentProfile || {};

    return PAYMENT_METHODS.filter((method) => {
      if (method.id === "wise_bank") {
        return true;
      }

      if (method.id === "remitly") {
        return (
          profile.remitly_link ||
          profile.remitly_instructions ||
          profile.bank_account_number ||
          profile.gcash_number ||
          profile.maya_number
        );
      }

      if (method.id === "stripe") {
        return Boolean(profile.stripe_payment_link);
      }

      if (method.id === "paypal") {
        return Boolean(profile.paypal_link || profile.paypal_email);
      }

      if (method.id === "manual_bank") {
        return Boolean(profile.bank_account_number);
      }

      return true;
    });
  }, [paymentProfile]);

  async function loadInvoice(invoiceToken) {
    try {
      setLoading(true);

      const response = await fetch(`/api/public-invoice/${invoiceToken}`, {
        method: "GET",
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.error || "Invoice not found.");
        setLoading(false);
        return;
      }

      setInvoice(result.invoice);
      setItems(result.items || []);
      setPaymentProfile(result.payment_profile || null);
      setLoading(false);
    } catch (error) {
      setErrorMessage(error.message || "Something went wrong.");
      setLoading(false);
    }
  }

  function updatePaymentForm(e) {
    const { name, value } = e.target;

    setPaymentForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function submitPaymentConfirmation(e) {
    e.preventDefault();

    setSubmitting(true);

    const response = await fetch(`/api/public-invoice/${token}/submit-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: selectedMethod,
        amount: invoice.total,
        currency,
        ...paymentForm,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Unable to submit payment confirmation.");
      setSubmitting(false);
      return;
    }

    setPaymentSubmitted(true);
    setSubmitting(false);
  }

  function formatCurrency(amount, currencyCode = "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).format(Number(amount || 0));
  }

  function formatDate(date) {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function handlePrint() {
    window.print();
  }

  function copyText(value) {
    if (!value) return;

    navigator.clipboard.writeText(value);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        Loading invoice...
      </div>
    );
  }

  if (errorMessage || !invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">
            Invoice not found
          </h1>
          <p className="mt-2 text-slate-500">
            {errorMessage ||
              "The invoice link is invalid or no longer available."}
          </p>
        </div>
      </div>
    );
  }

  const selectedMethodData =
    PAYMENT_METHODS.find((method) => method.id === selectedMethod) ||
    PAYMENT_METHODS[0];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">VA System</h1>
            <p className="text-sm text-slate-500">
              Secure invoice payment instructions
            </p>
          </div>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Printer size={16} />
            Print / Save PDF
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:border-none print:shadow-none">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">INVOICE</h2>
              <p className="mt-2 text-slate-500">{invoice.invoice_number}</p>
            </div>

            <span className="inline-flex w-fit rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold capitalize text-blue-700">
              {invoice.status}
            </span>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Bill To
              </h3>

              <div className="mt-3 text-slate-700">
                <p className="font-bold text-slate-900">
                  {invoice.client?.name || "Client"}
                </p>

                {invoice.client?.company_name && (
                  <p>{invoice.client.company_name}</p>
                )}

                {invoice.client?.email && <p>{invoice.client.email}</p>}
                {invoice.client?.phone && <p>{invoice.client.phone}</p>}

                {invoice.client?.billing_address && (
                  <p className="mt-2 whitespace-pre-line">
                    {invoice.client.billing_address}
                  </p>
                )}
              </div>
            </div>

            <div className="sm:text-right">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Invoice Details
              </h3>

              <div className="mt-3 space-y-1 text-slate-700">
                <p>
                  <span className="font-medium">Period:</span>{" "}
                  {invoice.period_start || "—"} to {invoice.period_end || "—"}
                </p>

                <p>
                  <span className="font-medium">Due date:</span>{" "}
                  {formatDate(invoice.due_date)}
                </p>

                <p>
                  <span className="font-medium">Created:</span>{" "}
                  {formatDate(invoice.created_at)}
                </p>

                <p>
                  <span className="font-medium">Currency:</span> {currency}
                </p>

                <p>
                  <span className="font-medium">Source:</span>{" "}
                  {invoice.item_source === "time_logs"
                    ? "Time logs"
                    : "Invoice items"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {invoice.item_source === "invoice_items" ? "Qty" : "Hours"}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No invoice items found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-4 text-slate-700">
                        <p>{item.description}</p>

                        {item.date && (
                          <p className="mt-1 text-xs text-slate-400">
                            {formatDate(item.date)}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-slate-700">
                        {Number(item.quantity || 0).toFixed(2)}
                      </td>

                      <td className="px-4 py-4 text-right text-slate-700">
                        {formatCurrency(item.rate, currency)}
                      </td>

                      <td className="px-4 py-4 text-right font-semibold text-slate-900">
                        {formatCurrency(item.amount, currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-end">
            <div className="w-full max-w-sm space-y-3">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatCurrency(invoice.subtotal, currency)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Tax</span>
                <span>{formatCurrency(invoice.tax, currency)}</span>
              </div>

              <div className="flex justify-between border-t border-slate-200 pt-3 text-xl font-bold text-slate-900">
                <span>Total</span>
                <span>{formatCurrency(invoice.total, currency)}</span>
              </div>
            </div>
          </div>

          {invoice.creator_bank_name && (
  <div className="mt-10 rounded-2xl border border-blue-100 bg-blue-50 p-5">
    <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">
      Payment Instructions
    </h3>

    <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-blue-950 sm:grid-cols-2">
      <p>
        <span className="font-semibold">Payee:</span>{" "}
        {invoice.creator_display_name}
      </p>

      <p>
        <span className="font-semibold">Bank:</span>{" "}
        {invoice.creator_bank_name}
      </p>

      <p>
        <span className="font-semibold">Account Name:</span>{" "}
        {invoice.creator_bank_account_name}
      </p>

      <p>
        <span className="font-semibold">Account Number:</span>{" "}
        {invoice.creator_bank_account_number}
      </p>

      {invoice.creator_bank_account_type && (
        <p>
          <span className="font-semibold">Account Type:</span>{" "}
          {invoice.creator_bank_account_type}
        </p>
      )}

      {invoice.creator_bank_branch && (
        <p>
          <span className="font-semibold">Branch:</span>{" "}
          {invoice.creator_bank_branch}
        </p>
      )}
    </div>

    {invoice.creator_bank_notes && (
      <p className="mt-4 whitespace-pre-line rounded-xl bg-white/70 p-3 text-sm text-blue-900">
        {invoice.creator_bank_notes}
      </p>
    )}
  </div>
)}

          <div className="mt-10 rounded-2xl bg-slate-50 p-5">
            <p className="text-sm text-slate-600">
              {invoice.notes ||
                "Thank you for your business. Please settle this invoice on or before the due date."}
            </p>
          </div>
        </div>

        <aside className="space-y-4 print:hidden">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Amount Due
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-950">
              {formatCurrency(invoice.total, currency)}
            </p>

            <p className="mt-1 text-sm text-blue-700">
              Default currency is USD. Pay directly to the VA or agency.
            </p>
          </div>

          {paymentSubmitted ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
              <div className="flex gap-3">
                <CheckCircle2
                  size={22}
                  className="mt-0.5 shrink-0 text-green-600"
                />
                <div>
                  <h3 className="font-bold text-green-900">
                    Payment confirmation submitted
                  </h3>
                  <p className="mt-1 text-sm text-green-700">
                    The VA or agency will verify your payment and mark this
                    invoice as paid.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form
              onSubmit={submitPaymentConfirmation}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <ReceiptText size={20} className="text-blue-600" />
                <h3 className="font-bold text-slate-900">I already paid</h3>
              </div>

              <p className="mt-2 text-sm text-slate-500">
                Submit your reference number or receipt link after payment.
              </p>

              <div className="mt-4 space-y-3">
                <Input
                  label="Sender Name"
                  name="sender_name"
                  value={paymentForm.sender_name}
                  onChange={updatePaymentForm}
                  placeholder="Your name"
                />

                <Input
                  label="Sender Email"
                  name="sender_email"
                  value={paymentForm.sender_email}
                  onChange={updatePaymentForm}
                  placeholder="you@email.com"
                />

                <Input
                  label="Reference Number"
                  name="reference_number"
                  value={paymentForm.reference_number}
                  onChange={updatePaymentForm}
                  placeholder="Transaction reference"
                />

                <Input
                  label="Receipt URL"
                  name="receipt_url"
                  value={paymentForm.receipt_url}
                  onChange={updatePaymentForm}
                  placeholder="Google Drive / image link"
                />

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={paymentForm.notes}
                    onChange={updatePaymentForm}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    placeholder="Optional notes"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Payment Confirmation"
                )}
              </button>
            </form>
          )}
        </aside>
      </main>
    </div>
  );
}

function PaymentInstructions({
  method,
  methodData,
  profile,
  invoice,
  currency,
  formatCurrency,
  copyText,
}) {
  const amountText = formatCurrency(invoice.total, currency);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-bold text-slate-900">{methodData.label}</h3>
      <p className="mt-1 text-sm text-slate-500">{methodData.description}</p>

      <div className="mt-4 space-y-3">
        <InfoRow label="Invoice Amount" value={amountText} onCopy={copyText} />
        <InfoRow label="Currency" value={currency} onCopy={copyText} />

        {(method === "wise_bank" || method === "manual_bank") && (
          <>
            <InfoRow
              label="Bank Name"
              value={profile?.bank_name}
              onCopy={copyText}
            />
            <InfoRow
              label="Account Name"
              value={profile?.bank_account_name}
              onCopy={copyText}
            />
            <InfoRow
              label="Account Number"
              value={profile?.bank_account_number}
              onCopy={copyText}
            />
            <InfoRow
              label="SWIFT Code"
              value={profile?.bank_swift_code}
              onCopy={copyText}
            />
            <InfoRow
              label="Country"
              value={profile?.bank_country}
              onCopy={copyText}
            />
            <InfoRow
              label="Wise Email"
              value={profile?.wise_email}
              onCopy={copyText}
            />

            {profile?.wise_link && (
              <ExternalButton href={profile.wise_link} label="Open Wise" />
            )}
          </>
        )}

        {method === "remitly" && (
          <>
            <InfoRow
              label="Instructions"
              value={profile?.remitly_instructions}
              onCopy={copyText}
            />
            <InfoRow
              label="Bank Name"
              value={profile?.bank_name}
              onCopy={copyText}
            />
            <InfoRow
              label="Account Name"
              value={profile?.bank_account_name}
              onCopy={copyText}
            />
            <InfoRow
              label="Account Number"
              value={profile?.bank_account_number}
              onCopy={copyText}
            />
            <InfoRow
              label="GCash"
              value={
                profile?.gcash_number
                  ? `${profile.gcash_name || ""} ${profile.gcash_number}`
                  : ""
              }
              onCopy={copyText}
            />
            <InfoRow
              label="Maya"
              value={
                profile?.maya_number
                  ? `${profile.maya_name || ""} ${profile.maya_number}`
                  : ""
              }
              onCopy={copyText}
            />

            {profile?.remitly_link && (
              <ExternalButton href={profile.remitly_link} label="Open Remitly" />
            )}
          </>
        )}

        {method === "stripe" && (
          <>
            {profile?.stripe_payment_link ? (
              <ExternalButton
                href={profile.stripe_payment_link}
                label="Pay by Card"
              />
            ) : (
              <p className="text-sm text-slate-500">
                Stripe payment link is not available.
              </p>
            )}
          </>
        )}

        {method === "paypal" && (
          <>
            <InfoRow
              label="PayPal Email"
              value={profile?.paypal_email}
              onCopy={copyText}
            />

            {profile?.paypal_link && (
              <ExternalButton href={profile.paypal_link} label="Open PayPal" />
            )}
          </>
        )}

        {profile?.payment_notes && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            {profile.payment_notes}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, onCopy }) {
  if (!value) return null;

  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="break-all text-sm font-medium text-slate-800">{value}</p>

        <button
          type="button"
          onClick={() => onCopy(value)}
          className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-200"
        >
          <Copy size={14} />
        </button>
      </div>
    </div>
  );
}

function ExternalButton({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
    >
      {label}
      <ExternalLink size={15} />
    </a>
  );
}

function Input({ label, name, value, onChange, placeholder }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">
        {label}
      </label>
      <input
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}