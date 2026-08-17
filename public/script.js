document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-track]");

    if (!target) {
        return;
    }

    const eventName = target.dataset.track;

    fetch("/api/track", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            event: eventName
        }),
        keepalive: true
    }).catch(() => {});
});