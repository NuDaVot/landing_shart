export async function onRequestPost(context) {
    try {
        const { request, env } = context;

        const body = await request.json();

        const event = body?.event;

        if (!event) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "Event is required"
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const allowedEvents = [
            "phone_nada",
            "phone_art",
            "telegram",
            "whatsapp",
            "product",
            "route"
        ];

        if (!allowedEvents.includes(event)) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "Unknown event"
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const cookieHeader = request.headers.get("Cookie") || "";

        const sourceMatch = cookieHeader.match(
            /(?:^|;\s*)analytics_source=([^;]+)/
        );

        const visitorMatch = cookieHeader.match(
            /(?:^|;\s*)analytics_visitor=([^;]+)/
        );

        const source = sourceMatch
            ? decodeURIComponent(sourceMatch[1])
            : "direct";

        const visitorId = visitorMatch
            ? decodeURIComponent(visitorMatch[1])
            : crypto.randomUUID();

        const url = new URL(request.url);

        await env.DB.prepare(`
            INSERT INTO events (
                source,
                event,
                path,
                visitor_id
            )
            VALUES (?, ?, ?, ?)
        `)
            .bind(
                source,
                event,
                url.pathname,
                visitorId
            )
            .run();

        const headers = new Headers({
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        });

        if (!visitorMatch) {
            headers.append(
                "Set-Cookie",
                `analytics_visitor=${encodeURIComponent(visitorId)}; Max-Age=2592000; Path=/; SameSite=Lax`
            );
        }

        return new Response(
            JSON.stringify({
                success: true
            }),
            {
                status: 200,
                headers
            }
        );
    } catch (error) {
        console.error(error);

        return new Response(
            JSON.stringify({
                success: false,
                error: "Internal server error"
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }
}