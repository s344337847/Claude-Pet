const PORT = 9876;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendEvent(event, sessionId, cwd) {
  try {
    const payload = {};
    if (sessionId) payload.session_id = sessionId;
    if (cwd) payload.cwd = cwd;
    const body = Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined;
    const res = await fetch(`${BASE_URL}/v1/event/${event}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });
    console.log(`Sent ${event}${sessionId ? ` (session_id=${sessionId})` : ""}${cwd ? ` (cwd=${cwd})` : ""}:`, res.status);
  } catch (err) {
    console.error(`Failed to send ${event}:`, err.message);
  }
}

async function main() {
  console.log("Testing Claude Pet event pipeline...\n");

  console.log("1. Work -> expect default pet Work animation");
  await sendEvent("work");
  await sleep(3000);

  console.log("2. Success -> expect default pet Success animation");
  await sendEvent("success");
  await sleep(5000);

  console.log("3. Multi-pet: work events for session-1 and session-2");
  await sendEvent("work", "session-1");
  await sleep(500);
  await sendEvent("work", "session-2");
  await sleep(3000);

  console.log("4. session-1 success -> expect session-1 pet celebrates and closes after ~2s");
  await sendEvent("success", "session-1");
  await sleep(4000);

  console.log("5. session-2 fail -> expect session-2 pet frowns and closes after ~2s");
  await sendEvent("fail", "session-2");
  await sleep(4000);

  console.log("6. Session lifecycle: session_start -> expect new pet slides up and enters");
  await sendEvent("session_start", "test-session");
  await sleep(3000);

  console.log("7. session_end -> expect test-session pet sinks and slides down, then closes after ~2s");
  await sendEvent("session_end", "test-session");
  await sleep(4000);

  console.log("\nTest complete.");
}

main();
