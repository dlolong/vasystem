import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request, context) {
  const { token } = await context.params;

  if (!token || token === "undefined" || token === "null") {
    return NextResponse.json(
      { error: "Invoice token is required." },
      { status: 400 }
    );
  }

  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .select(
      `
      *,
      clients (
            id,
            name,
            email,
            currency,
            hourly_rate
          )
    `
    )
    .eq("public_token", token)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!invoice) {
    return NextResponse.json(
      { error: "Invoice not found." },
      { status: 404 }
    );
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoice.id);
    
  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const subtotal =
    items?.length > 0
      ? items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
      : Number(invoice.total_amount || 0);

  const tax = Number(invoice.tax || 0);
  const total = subtotal + tax;

  return NextResponse.json({
    invoice: {
      ...invoice,
      client: invoice.clients,
      currency: invoice.currency || invoice.clients?.currency || "USD",
      subtotal,
      tax,
      total,
      invoice_number:
        invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`,
    },
    items: items || [],
  });
}