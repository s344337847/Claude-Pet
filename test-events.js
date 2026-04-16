const PORT = 9876;
const URL = `http://127.0.0.1:${PORT}/v1/event`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendEvent(event) {
  const body = { event };

  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    console.log(`Sent ${event}:`, res.status);
  } catch (err) {
    console.error(`Failed to send ${event}:`, err.message);
  }
}

async function main() {
  console.log("Testing Claude Pet event pipeline with official hooks...\n");

  console.log("1. UserPromptSubmit -> expect Work animation");
  await sendEvent("work");
  await sleep(3000);

  console.log("2. Stop -> expect Success animation");
  await sendEvent("success");
  await sleep(5000);

  console.log("3. Another UserPromptSubmit -> expect Work animation");
  await sendEvent("work");
  await sleep(3000);

  console.log("4. Stop -> expect Success animation");
  await sendEvent("success");
  await sleep(4000);

  console.log("\nTest complete.");
}

main();
