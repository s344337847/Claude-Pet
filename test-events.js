const PORT = 9876;
const URL = `http://127.0.0.1:${PORT}/v1/event`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendEvent(status, taskId = "1", subject = "Test task") {
  const body = {
    type: "task_status_change",
    task_id: taskId,
    status: status,
    subject: subject,
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    console.log(`Sent ${status}:`, res.status);
  } catch (err) {
    console.error(`Failed to send ${status}:`, err.message);
  }
}

async function main() {
  console.log("Testing Claude Pet event pipeline...\n");

  console.log("1. Task in progress -> expect Work animation");
  await sendEvent("in_progress", "1", "Implement login flow");
  await sleep(3000);

  console.log("2. Task completed -> expect Success animation");
  await sendEvent("completed", "1", "Implement login flow");
  await sleep(5000);

  console.log("3. Another task in progress -> expect Work animation");
  await sendEvent("in_progress", "2", "Fix bug in parser");
  await sleep(3000);

  console.log("4. Task failed -> expect Fail animation");
  await sendEvent("failed", "2", "Fix bug in parser");
  await sleep(4000);

  console.log("\nTest complete.");
}

main();
