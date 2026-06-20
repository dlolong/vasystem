import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
    try {
        const body = await request.json();

        const authHeader = request.headers.get("authorization");

        if (!authHeader) {
            return NextResponse.json(
                { error: "Missing authorization header." },
                { status: 401 }
            );
        }

        const supabaseUser = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                global: {
                    headers: {
                        Authorization: authHeader,
                    },
                },
            }
        );

        const {
            data: { user },
            error: userError,
        } = await supabaseUser.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                { error: "Invalid user session." },
                { status: 401 }
            );
        }

        const targetEmail =
            body.target_email || body.email || body.va_email || body.client_email;

        if (!targetEmail) {
            return NextResponse.json(
                { error: "Target email is required." },
                { status: 400 }
            );
        }

        const { data: connection, error: connectionError } =
            await supabaseUser.rpc("add_app_connection", {
                p_source_type: body.source_type,
                p_target_type: body.target_type,
                p_target_email: targetEmail,
                p_source_organization_id: body.source_organization_id || null,
                p_source_client_id: body.source_client_id || null,
                p_hourly_rate: Number(body.hourly_rate || 0),
                p_currency: body.currency || "USD",
            });

        if (connectionError) {
            return NextResponse.json(
                { error: connectionError.message },
                { status: 400 }
            );
        }

        if (connection?.status === "pending") {
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            const role = body.target_type;
            const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/signup?role=${role}`;

            const { error: inviteError } =
                await supabaseAdmin.auth.admin.inviteUserByEmail(
                    body.target_email,
                    {
                        redirectTo,
                        data: {
                            role,
                            invited_by: user.id,
                        },
                    }
                );

            if (inviteError) {
                return NextResponse.json(
                    {
                        connection,
                        warning: inviteError.message,
                    },
                    { status: 200 }
                );
            }

            await supabaseAdmin
                .from("app_connections")
                .update({
                    invitation_sent_at: new Date().toISOString(),
                })
                .eq("id", connection.id);
        }

        return NextResponse.json({
            connection,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error.message || "Unable to add connection." },
            { status: 500 }
        );
    }
}