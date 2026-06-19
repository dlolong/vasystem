import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const token = resolvedParams?.token;

    if (!token) {
      return NextResponse.json(
        { error: "Missing invoice token." },
        { status: 400 }
      );
    }

    // 1. Load invoice WITHOUT embedding clients.
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();

    if (invoiceError) {
      return NextResponse.json(
        { error: invoiceError.message },
        { status: 500 }
      );
    }

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found." },
        { status: 404 }
      );
    }

    // 2. Load client separately to avoid ambiguous relationship error.
    const clientId = invoice.client_id || invoice.bill_to_client_id || null;

    let client = null;

    if (clientId) {
      const { data: clientData, error: clientError } = await supabaseAdmin
        .from("clients")
        .select(
          `
          id,
          name,
          email,
          phone,
          company_name,
          billing_address,
          currency,
          hourly_rate
        `
        )
        .eq("id", clientId)
        .maybeSingle();

      if (clientError) {
        return NextResponse.json(
          { error: clientError.message },
          { status: 500 }
        );
      }

      client = clientData || null;
    }

    const currency = normalizeCurrency(invoice.currency || client?.currency);

    const isVAInvoice = Boolean(invoice.user_id);
    const isAgencyInvoice =
      !invoice.user_id && Boolean(invoice.organization_id);

    let items = [];
    let itemSource = "empty";

    if (isVAInvoice) {
      items = await loadTimeLogItems(invoice.id, client);
      itemSource = items.length > 0 ? "time_logs" : "empty";
    } else if (isAgencyInvoice) {
      items = await loadInvoiceItems(invoice.id);
      itemSource = items.length > 0 ? "invoice_items" : "empty";
    } else {
      items = await loadInvoiceItems(invoice.id);

      if (items.length === 0) {
        items = await loadTimeLogItems(invoice.id, client);
      }

      itemSource = items.length > 0 ? "fallback" : "empty";
    }

    const subtotal =
      items.length > 0
        ? items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
        : Number(invoice.total_amount || 0);

    const tax = Number(invoice.tax || 0);
    const total = subtotal + tax;

    return NextResponse.json({
      invoice: {
        ...invoice,
        client,
        currency,
        subtotal,
        tax,
        total,
        item_source: itemSource,
        invoice_number:
          invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`,
      },
      items,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to load public invoice." },
      { status: 500 }
    );
  }
}

async function loadInvoiceItems(invoiceId) {
  const { data, error } = await supabaseAdmin
    .from("invoice_items")
    .select(
      `
      id,
      invoice_id,
      description,
      quantity,
      rate,
      amount,
      time_log_id
    `
    )
    .eq("invoice_id", invoiceId);

  if (error) {
    console.error("Public invoice_items error:", error);
    return [];
  }

  return (data || []).map((item) => {
    const quantity = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    const amount =
      Number(item.amount || 0) || Number((quantity * rate).toFixed(2));

    return {
      id: item.id,
      type: "invoice_item",
      description: item.description || "Invoice item",
      quantity,
      rate,
      amount,
      date: null,
    };
  });
}

async function loadTimeLogItems(invoiceId, client) {
  const { data, error } = await supabaseAdmin
    .from("time_logs")
    .select(
      `
      id,
      start_time,
      end_time,
      duration,
      description,
      hourly_rate,
      currency,
      invoice_id,
      billable,
      invoiced
    `
    )
    .eq("invoice_id", invoiceId)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Public time_logs error:", error);
    return [];
  }

  return (data || []).map((log) => {
    const hours = Number((Number(log.duration || 0) / 3600).toFixed(2));
    const rate = Number(log.hourly_rate || client?.hourly_rate || 0);
    const amount = Number((hours * rate).toFixed(2));

    return {
      id: log.id,
      type: "time_log",
      description: log.description || "VA services",
      quantity: hours,
      rate,
      amount,
      date: log.start_time,
    };
  });
}

function normalizeCurrency(currency) {
  return currency?.trim()?.toUpperCase() || "USD";
}