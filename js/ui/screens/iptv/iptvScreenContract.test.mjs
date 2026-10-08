import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Static guard: every this.NAME( call in the screen mixins must be defined once.
const FILES = ["iptvScreen.js", "iptvScreenData.js", "iptvScreenFocus.js", "iptvDetailView.js"];
const EXTERNAL = new Set(); // add router/base methods here if the screen ever inherits any
const src = FILES.map((f) => [f, readFileSync(new URL(`./${f}`, import.meta.url), "utf8")]);

const defined = new Map();
for (const [file, text] of src) {
  for (const m of text.matchAll(/^ {2}(?:async )?([A-Za-z_]\w*)\([^)]*\)\s*\{/gm)) {
    defined.set(m[1], [...(defined.get(m[1]) || []), file]);
  }
}

test("every this.method() call in iptv screen mixins is defined", () => {
  const missing = new Set();
  for (const [, text] of src) {
    for (const m of text.matchAll(/this\.([A-Za-z_]\w*)\(/g)) {
      if (!defined.has(m[1]) && !EXTERNAL.has(m[1])) missing.add(m[1]);
    }
  }
  assert.deepEqual([...missing], []);
});

test("no screen method is defined twice", () => {
  const dupes = [...defined].filter(([, files]) => files.length > 1).map(([name]) => name);
  assert.deepEqual(dupes, []);
});
