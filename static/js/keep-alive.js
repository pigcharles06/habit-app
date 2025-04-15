// static/js/keep-alive.js

/**
 * Sends a background request to the server periodically to prevent
 * service providers (like Render free tier) from spinning down the instance due to inactivity.
 */
function keepAwake() {
    // console.log("Sending keep-alive ping..."); // Keep this log minimal
    fetch('/') // Fetch the root URL or a dedicated '/health' endpoint if you have one
        .then(response => {
            if (!response.ok) {
                 // Log unexpected statuses, but don't make it alarming for users
                 console.warn(`Keep-alive request received status: ${response.status}`);
            }
            // No need to log success every time unless debugging
            // else { console.log("Keep-alive successful."); }
        })
        .catch(error => {
             // Log network errors, but avoid alerting the user
             console.error("Keep-alive request failed:", error);
        });
}

/**
 * Starts the keep-alive timer.
 * Sends the first request immediately, then sets an interval.
 * @param {number} [intervalMs=840000] - Interval in milliseconds. Defaults to 14 minutes (840,000 ms),
 * which is typically safe for services with a 15-minute inactivity timeout.
 */
function startKeepAliveTimer(intervalMs = 14 * 60 * 1000) { // 14 minutes default
    const minInterval = 5 * 60 * 1000; // 5 minutes minimum reasonable interval

    if (intervalMs < minInterval) {
        console.warn(`Keep-alive interval too short (${intervalMs}ms). Setting to minimum (${minInterval}ms).`);
        intervalMs = minInterval;
    }

    // Send the first ping immediately on load
    console.log("Keep-alive: Sending initial request.");
    keepAwake();

    // Set the recurring interval timer
    setInterval(keepAwake, intervalMs);
    console.log(`Keep-alive timer started. Pinging every ${intervalMs / 60000} minutes.`);
}