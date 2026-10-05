import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const metadata = JSON.parse(await readFile(".cache/module-build-meta.json", "utf8"));
const initial = new Set();
function visit(output) {
  if (initial.has(output)) return;
  assert.ok(metadata.outputs[output], `Missing output: ${output}`);
  initial.add(output);
  for (const imported of metadata.outputs[output].imports) {
    if (imported.kind === "import-statement" && !imported.external) visit(imported.path);
  }
}
visit("dist/app.module.js");
const inputs = new Set([...initial].flatMap(output => Object.keys(metadata.outputs[output].inputs)));
assert.deepEqual([...inputs].filter(input => /screens\/(detail|stream|player|settings)\//.test(input)), [],
  "Heavy screen UI entered the initial import graph");
for (const output of Object.keys(metadata.outputs)) {
  const built = await stat(output);
  const packaged = await stat(output.replace(/^dist\//, ".cache/webos-package/app/"));
  assert.equal(packaged.size, built.size, `Packaged chunk differs: ${output}`);
}
const initialBytes = [...initial].reduce((sum, output) => sum + metadata.outputs[output].bytes, 0);
const legacyBytes = (await stat("dist/app.bundle.js")).size;
assert.ok(initialBytes < legacyBytes, "Splitting did not reduce initial JavaScript");
assert.match(await readFile("dist/index.html", "utf8"), /assets\/runtime\/load-app\.js/);
assert.match(await readFile(".cache/webos-package/app/index.html", "utf8"), /assets\/runtime\/load-app\.js/);
assert.equal(await readFile(".cache/webos-package/app/assets/runtime/load-app.js", "utf8"),
  await readFile("assets/runtime/load-app.js", "utf8"));
assert.match(await readFile("assets/runtime/load-app.js", "utf8"), /app\.bundle\.js/);
console.log(JSON.stringify({ initialFiles: initial.size, initialBytes, legacyBytes,
  reductionPercent: Number((100 * (1 - initialBytes / legacyBytes)).toFixed(1)),
  totalOutputs: Object.keys(metadata.outputs).length }));
