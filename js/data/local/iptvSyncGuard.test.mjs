import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// IPTV credentials are device + profile local (plan D1): no cloud sync path may
// reference the store key. A new sync feature must not pick it up silently.
test("no sync service or feature references the IPTV store", () => {
  const dir = new URL("../../core/profile/", import.meta.url).pathname;
  const offenders = readdirSync(dir)
    .filter((name) => /sync/i.test(name) && name.endsWith(".js"))
    .filter((name) => /iptvSources|IptvSources/.test(readFileSync(join(dir, name), "utf8")));
  assert.deepEqual(offenders, []);
});
