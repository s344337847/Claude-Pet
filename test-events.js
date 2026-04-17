const PORT = 9876;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendEvent(event, taskId) {
  try {
    const body = taskId ? JSON.stringify({ task_id: taskId }) : undefined;
    const res = await fetch(`${BASE_URL}/v1/event/${event}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });
    console.log(`Sent ${event}${taskId ? ` (task_id=${taskId})` : ""}:`, res.status);
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

  console.log("3. Multi-pet: work events for task-1 and task-2");
  await sendEvent("work", "task-1");
  await sleep(500);
  await sendEvent("work", "task-2");
  await sleep(3000);

  console.log("4. task-1 success -> expect task-1 pet celebrates and closes after ~2s");
  await sendEvent("success", "task-1");
  await sleep(4000);

  console.log("5. task-2 fail -> expect task-2 pet frowns and closes after ~2s");
  await sendEvent("fail", "task-2");
  await sleep(4000);

  console.log("\nTest complete.");
}

main();
