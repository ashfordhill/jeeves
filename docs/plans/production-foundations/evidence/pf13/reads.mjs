const [url, total = "2000", concurrency = "50"] = process.argv.slice(2);
const times = [];
let failed = 0;
let next = 0;
const started = performance.now();
async function worker() {
  while (next < Number(total)) {
    next += 1;
    const at = performance.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      await response.arrayBuffer();
      if (response.status !== 200) failed += 1;
    } catch {
      failed += 1;
    }
    times.push(performance.now() - at);
  }
}
await Promise.all(Array.from({ length: Number(concurrency) }, worker));
const seconds = (performance.now() - started) / 1000;
times.sort((a, b) => a - b);
const at = (p) => Math.round(times[Math.min(times.length - 1, Math.floor(times.length * p))]);
console.log(
  JSON.stringify({
    total: times.length,
    concurrency: Number(concurrency),
    seconds: Number(seconds.toFixed(2)),
    perSecond: Math.round(times.length / seconds),
    p50Ms: at(0.5),
    p95Ms: at(0.95),
    p99Ms: at(0.99),
    failed,
  }),
);
