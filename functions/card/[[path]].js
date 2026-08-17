export async function onRequest(context) {
    const { request, env, params } = context;

    const pathParts = params.path;

    let cardId = "";

    if (Array.isArray(pathParts)) {
        cardId = pathParts.join("/");
    } else if (typeof pathParts === "string") {
        cardId = pathParts;
    }

    if (!cardId) {
        return env.ASSETS.fetch(request);
    }

    const source = `card/${cardId}`;

    let visitorId = crypto.randomUUID();

    const cookieHeader = request.headers.get("Cookie") || "";

    const visitorMatch = cookieHeader.match(
        /(?:^|;\s*)analytics_visitor=([^;]+)/
    );

    if (visitorMatch) {
        visitorId = decodeURIComponent(visitorMatch[1]);
    }

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
            "visit",
            `/card/${cardId}`,
            visitorId
        )
        .run();

    const response = await env.ASSETS.fetch(
        new Request(
            new URL("/", request.url),
            request
        )
    );

    const headers = new Headers(response.headers);

    headers.set(
        "Set-Cookie",
        `analytics_source=${encodeURIComponent(source)}; Max-Age=2592000; Path=/; SameSite=Lax`
    );

    if (!visitorMatch) {
        headers.append(
            "Set-Cookie",
            `analytics_visitor=${encodeURIComponent(visitorId)}; Max-Age=2592000; Path=/; SameSite=Lax`
        );
    }

    headers.set(
        "X-Robots-Tag",
        "noindex, follow"
    );

    return new Response(
        response.body,
        {
            status: response.status,
            statusText: response.statusText,
            headers
        }
    );
}