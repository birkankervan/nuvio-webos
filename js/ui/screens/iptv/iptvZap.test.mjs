import test from "node:test";
import assert from "node:assert/strict";
import { neighborChannel, zapDirection } from "./iptvZap.js";

const list = [
  { id: "a", name: "One" },
  { id: "b", name: "=== SPORT ===" },
  { id: "c", name: "Three" },
  { id: "d", name: "Four" }
];

test("next/prev wrap and skip separators", () => {
  assert.equal(neighborChannel(list, "a", 1).id, "c");
  assert.equal(neighborChannel(list, "c", -1).id, "a");
  assert.equal(neighborChannel(list, "d", 1).id, "a");
  assert.equal(neighborChannel(list, "a", -1).id, "d");
});

test("unknown id, empty or single list", () => {
  assert.equal(neighborChannel(list, "zzz", 1), null);
  assert.equal(neighborChannel([], "a", 1), null);
  assert.equal(neighborChannel([list[0]], "a", 1), null);
  assert.equal(neighborChannel([list[0], list[1]], "a", 1), null);
});

test("key codes", () => {
  assert.deepEqual([33, 427, 34, 428, 13].map(zapDirection), [1, 1, -1, -1, 0]);
});
