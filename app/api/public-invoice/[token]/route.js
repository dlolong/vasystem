import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request, context) {
  try {
    const { token } = await context.params

    if (!token) {
      return NextResponse.json(
        { error: 'Invoice token is required.' },
        { status: 400 }
      )
    }

    console.log('PUBLIC INVOICE TOKEN:', token)

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select(`
        id,
        invoice_number,
        period_start,
        period_end,
        subtotal,
        tax,
        total,
        status,
        due_date,
        created_at,
        public_token,
        clients (
          name,
          company_name,
          email,
          phone,
          billing_address,
          currency
        )
      `)
      .eq('public_token', token)
      .maybeSingle()

    if (invoiceError) {
      console.error('PUBLIC INVOICE ERROR:', invoiceError)

      return NextResponse.json(
        { error: invoiceError.message },
        { status: 500 }
      )
    }

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found.' },
        { status: 404 }
      )
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from('invoice_items')
      .select(`
        id,
        description,
        quantity,
        rate,
        amount
      `)
      .eq('invoice_id', invoice.id)

    if (itemsError) {
      return NextResponse.json(
        { error: itemsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      invoice: {
        invoice_number: invoice.invoice_number,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        status: invoice.status,
        due_date: invoice.due_date,
        created_at: invoice.created_at,
        client: {
          name: invoice.clients?.name,
          company_name: invoice.clients?.company_name,
          email: invoice.clients?.email,
          phone: invoice.clients?.phone,
          billing_address: invoice.clients?.billing_address,
          currency: invoice.clients?.currency || 'PHP',
        },
      },
      items: items || [],
    })
  } catch (error) {
    console.error('PUBLIC INVOICE SERVER ERROR:', error)

    return NextResponse.json(
      { error: error.message || 'Something went wrong.' },
      { status: 500 }
    )
  }
}