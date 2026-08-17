export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        /*
         * ==========================================
         * QR-КОДЫ
         *
         * /card/01
         * /card/02
         * /card/03
         * ==========================================
         */

        const cardMatch = url.pathname.match(
            /^\/card\/([a-zA-Z0-9_-]+)\/?$/
        );

        if (cardMatch) {
            const cardId = cardMatch[1];
            const source = `card/${cardId}`;

            let visitorId = crypto.randomUUID();

            const cookieHeader =
                request.headers.get("Cookie") || "";

            const visitorMatch = cookieHeader.match(
                /(?:^|;\s*)analytics_visitor=([^;]+)/
            );

            if (visitorMatch) {
                visitorId = decodeURIComponent(
                    visitorMatch[1]
                );
            }

            /*
             * Записываем сканирование QR
             */

            try {
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
                        url.pathname,
                        visitorId
                    )
                    .run();
            } catch (error) {
                console.error(
                    "Analytics error:",
                    error
                );
            }

            /*
             * Отдаём главную страницу
             */

            const response =
                await env.ASSETS.fetch(
                    new Request(
                        new URL("/", request.url),
                        request
                    )
                );

            const headers = new Headers(
                response.headers
            );

            /*
             * Сохраняем источник QR
             */

            headers.append(
                "Set-Cookie",
                `analytics_source=${encodeURIComponent(
                    source
                )}; Max-Age=2592000; Path=/; SameSite=Lax`
            );

            /*
             * Сохраняем посетителя
             */

            if (!visitorMatch) {
                headers.append(
                    "Set-Cookie",
                    `analytics_visitor=${encodeURIComponent(
                        visitorId
                    )}; Max-Age=2592000; Path=/; SameSite=Lax`
                );
            }

            /*
             * QR-страницы не индексируем
             */

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

        /*
         * ==========================================
         * АНАЛИТИКА КЛИКОВ
         *
         * POST /api/track
         * ==========================================
         */

        if (
            url.pathname === "/api/track" &&
            request.method === "POST"
        ) {
            try {
                const body =
                    await request.json();

                const event = body?.event;

                const allowedEvents = [
                    "phone_nada",
                    "phone_art",
                    "telegram",
                    "whatsapp",
                    "product",
                    "route"
                ];

                if (
                    !event ||
                    !allowedEvents.includes(event)
                ) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: "Unknown event"
                        }),
                        {
                            status: 400,
                            headers: {
                                "Content-Type":
                                    "application/json"
                            }
                        }
                    );
                }

                const cookieHeader =
                    request.headers.get("Cookie") || "";

                const sourceMatch =
                    cookieHeader.match(
                        /(?:^|;\s*)analytics_source=([^;]+)/
                    );

                const visitorMatch =
                    cookieHeader.match(
                        /(?:^|;\s*)analytics_visitor=([^;]+)/
                    );

                const source = sourceMatch
                    ? decodeURIComponent(
                          sourceMatch[1]
                      )
                    : "direct";

                const visitorId = visitorMatch
                    ? decodeURIComponent(
                          visitorMatch[1]
                      )
                    : crypto.randomUUID();

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

                return new Response(
                    JSON.stringify({
                        success: true
                    }),
                    {
                        status: 200,
                        headers: {
                            "Content-Type":
                                "application/json",
                            "Cache-Control":
                                "no-store"
                        }
                    }
                );

            } catch (error) {
                console.error(error);

                return new Response(
                    JSON.stringify({
                        success: false,
                        error:
                            "Internal server error"
                    }),
                    {
                        status: 500,
                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );
            }
        }

        /*
         * ==========================================
         * ВСЁ ОСТАЛЬНОЕ
         *
         * Сайт, CSS, JS, картинки, robots.txt
         * ==========================================
         */

        return env.ASSETS.fetch(request);
    }
};