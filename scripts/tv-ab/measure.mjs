// Usage: node measure.mjs <label> <ws-url>
// Synthetic CDP keys on the TV; collects keydown handler latency, rAF deltas, long tasks.
const [label, wsUrl] = process.argv.slice(2);
const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const T0 = Date.now();
const log = (m) => process.stderr.write(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${m}\n`);
setTimeout(() => { log("hard timeout"); console.log(JSON.stringify({ label, error: "hard timeout" })); process.exit(3); }, 240000);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; setTimeout(() => j(new Error("open timeout")), 15000); });
log("open");
const send = (method, params = {}) => new Promise((r) => {
  const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params }));
  setTimeout(() => { if (pending.has(i)) { console.log(JSON.stringify({ label, error: `cdp timeout ${method}` })); process.exit(2); } }, 20000);
});
ws.onclose = () => { console.log(JSON.stringify({ label, error: "ws closed" })); process.exit(2); };
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEYS = { Right: [39, "ArrowRight"], Left: [37, "ArrowLeft"], Down: [40, "ArrowDown"], Up: [38, "ArrowUp"], Enter: [13, "Enter"], Back: [461, "GoBack"] };
async function key(name) {
  const [code, k] = KEYS[name];
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: k, code: k });
  await send("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: k, code: k });
}
const homeReady = `(() => { const f = document.querySelector(".home-shell .focused"); return Boolean(document.querySelector(".home-shell") && f && f.isConnected && f.getBoundingClientRect().width > 0); })()`;

for (let i = 0; i < 120 && !(await ev(homeReady)); i++) await sleep(500);
if (!(await ev(homeReady))) { console.log(JSON.stringify({ label, error: "home not ready" })); process.exit(1); }
log("home ready");
// 1.2.3 shows an informational update dialog (single OK -> close) that swallows keys.
for (let i = 0; i < 3 && (await ev(`Boolean(document.querySelector(".app-update-dialog"))`)); i++) { await key("Enter"); await sleep(1000); log("update dialog closed"); }
const row1Ready = `document.querySelectorAll('.home-shell .home-content-card[data-nav-row="1"]').length >= 5`;
for (let i = 0; i < 60 && !(await ev(row1Ready)); i++) await sleep(500);
log("row1 ready " + (await ev(row1Ready)));
await sleep(10000); // identical settle for every run
for (let i = 0; i < 3 && (await ev(`Boolean(document.querySelector(".app-update-dialog"))`)); i++) { await key("Enter"); await sleep(1000); log("late update dialog closed"); }

await ev(`(() => {
  if (window.__P) return;
  const P = window.__P = { raf: [], lt: [], h: [], on: false };
  let last = 0;
  const loop = (t) => { if (P.on && last) P.raf.push(t - last); last = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  new PerformanceObserver((l) => { if (P.on) l.getEntries().forEach((e) => P.lt.push(e.duration)); }).observe({ entryTypes: ["longtask"] });
  const ch = new MessageChannel();
  let t0 = 0;
  ch.port1.onmessage = () => { if (P.on) P.h.push(performance.now() - t0); };
  window.addEventListener("keydown", () => { t0 = performance.now(); ch.port2.postMessage(0); }, true);
})()`);
const reset = () => ev(`(() => { Object.assign(window.__P, { raf: [], lt: [], h: [], on: true }); })()`);
const collect = async () => {
  const P = await ev(`(() => { window.__P.on = false; return { raf: window.__P.raf, lt: window.__P.lt, h: window.__P.h }; })()`);
  const p = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1); };
  return { keys: P.h.length, hP50: p(P.h, 0.5), hP95: p(P.h, 0.95), rafP95: p(P.raf, 0.95), rafMax: p(P.raf, 1), lt: P.lt.length, ltMax: +Math.max(0, ...P.lt).toFixed(0) };
};

// Enter content and move to the first catalog row (row 1, never Continue Watching).
const inCard = `Boolean(document.querySelector(".home-shell .focused.home-content-card"))`;
const navRow = `Number(document.querySelector(".home-shell .focused")?.dataset.navRow ?? -1)`;
const pos = `(() => { const f = document.querySelector(".home-shell .focused"); return f ? f.dataset.navRow + ":" + f.dataset.navCol : ""; })()`;
for (let i = 0; i < 3 && !(await ev(inCard)); i++) { await key("Right"); await sleep(600); }
for (let i = 0; i < 6 && (await ev(navRow)) > 1; i++) { await key("Up"); await sleep(600); }
for (let i = 0; i < 5 && (await ev(navRow)) === 0; i++) { await key("Down"); await sleep(1000); }
if ((await ev(navRow)) !== 1) { console.log(JSON.stringify({ label, error: "start " + (await ev(pos)) })); process.exit(4); }
for (let i = 0; i < 25 && (await ev(pos)) !== "1:0"; i++) { await key("Left"); await sleep(200); }

// Warm-up (not recorded)
for (const k of ["Right", "Right", "Right", "Right", "Right", "Left", "Left", "Left", "Left", "Left"]) { await key(k); await sleep(150); }
await sleep(2000);

const out = { label, start: await ev(pos) };
await reset();
for (let r = 0; r < 2; r++) {
  for (let i = 0; i < 15; i++) { await key("Right"); await sleep(150); }
  out["far" + r] = await ev(pos);
  for (let i = 0; i < 15; i++) { await key("Left"); await sleep(150); }
}
await sleep(1500);
out.horizontal = await collect(); log("horizontal");

await reset();
for (let i = 0; i < 10; i++) { await key("Down"); await sleep(350); }
out.bottom = await ev(pos);
for (let i = 0; i < 10; i++) { await key("Up"); await sleep(350); }
await sleep(1500);
out.vertical = await collect(); log("vertical");

// Back probe: open Detail from the row 1 card, Back until Home focus is painted.
for (let i = 0; i < 4 && (await ev(navRow)) !== 1; i++) { await key((await ev(navRow)) > 1 ? "Up" : "Down"); await sleep(600); }
out.backFrom = await ev(pos);
if (/^1:/.test(out.backFrom)) {
  await key("Enter");
  for (let i = 0; i < 40 && (await ev(homeReady)); i++) await sleep(250);
  await sleep(4000);
  await ev(`(() => { window.__B = 0; window.__Bstart = () => { const s = performance.now(); const tick = () => { const f = document.querySelector(".home-shell .focused"); if (f && f.isConnected && f.getBoundingClientRect().width > 0) requestAnimationFrame(() => requestAnimationFrame(() => { window.__B = performance.now() - s; })); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }; })()`);
  await ev(`window.__Bstart()`);
  await key("Back");
  for (let i = 0; i < 60 && !(await ev(`window.__B`)); i++) await sleep(100);
  out.backMs = Math.round(await ev(`window.__B`));
  await sleep(1000);
  out.backFocus = await ev(pos);
} else out.backMs = null;
out.errors = await ev(`(window.__nuvioErrors || []).length`);
log("done");
console.log(JSON.stringify(out));
process.exit(0);
