import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
    try {
        const { invoiceId } = await request.json()

        if (!invoiceId) {
            return NextResponse.json(
                { error: 'Invoice ID is required.' },
                { status: 400 }
            )
        }

        const authHeader = request.headers.get('authorization')

        if (!authHeader) {
            return NextResponse.json(
                { error: 'Missing authorization token.' },
                { status: 401 }
            )
        }

        const token = authHeader.replace('Bearer ', '')

        const {
            data: { user },
            error: userError,
        } = await supabaseAdmin.auth.getUser(token)

        if (userError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized request.' },
                { status: 401 }
            )
        }

        const { data: invoice, error: invoiceError } = await supabaseAdmin
            .from('invoices')
            .select(`
        *,
        clients (
          name,
          email,
          currency
        )
      `)
            .eq('id', invoiceId)
            .eq('user_id', user.id)
            .single()

        if (invoiceError || !invoice) {
            return NextResponse.json(
                { error: 'Invoice not found.' },
                { status: 404 }
            )
        }

        if (!invoice.clients?.email) {
            return NextResponse.json(
                { error: 'Client has no email address.' },
                { status: 400 }
            )
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL
        // const invoiceUrl = `${appUrl}/invoices/${invoice.id}`
        const invoiceUrl = `${appUrl}/public-invoice/${invoice.id}`
        const currency = invoice.clients?.currency || 'PHP'

        const formattedTotal = new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency,
        }).format(invoice.total || 0)

        const { error: emailError } = await resend.emails.send({
            from: 'VA System <invoices@yourdomain.com>',
            to: invoice.clients.email,
            subject: `Invoice ${invoice.invoice_number} from VA System`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
          <h2 style="margin-bottom: 8px;">New Invoice</h2>

          <p>Hello ${invoice.clients.name},</p>

          <p>
            Your invoice <strong>${invoice.invoice_number}</strong> is now ready.
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0 0 8px;">
              <strong>Invoice Number:</strong> ${invoice.invoice_number}
            </p>

            <p style="margin: 0 0 8px;">
              <strong>Billing Period:</strong> ${invoice.period_start} to ${invoice.period_end}
            </p>

            <p style="margin: 0 0 8px;">
              <strong>Due Date:</strong> ${invoice.due_date}
            </p>

            <p style="margin: 0;">
              <strong>Total Amount:</strong> ${formattedTotal}
            </p>
          </div>

          <p>
            You can view the invoice using the button below:
          </p>

          <p style="margin: 24px 0;">
            <a
              href="${invoiceUrl}"
              style="background: #2563eb; color: white; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: bold; display: inline-block;"
            >
              View Invoice
            </a>
          </p>

          <p>
            Thank you.
          </p>
        </div>
      `,
        })

        if (emailError) {
            return NextResponse.json(
                { error: emailError.message },
                { status: 500 }
            )
        }

        const { error: updateError } = await supabaseAdmin
            .from('invoices')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
            })
            .eq('id', invoice.id)

        if (updateError) {
            return NextResponse.json(
                { error: updateError.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Invoice sent successfully.',
        })
    } catch (error) {
        return NextResponse.json(
            { error: error.message || 'Something went wrong.' },
            { status: 500 }
        )
    }
}