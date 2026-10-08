import test from "node:test";
import assert from "node:assert/strict";
import { isSeparatorName } from "./iptvCards.js";

test("provider category separator rows are detected", () => {
  for (const name of [
    "▃ ▅ ▆ █ ULUSAL HEVC █ ▆ ▅ ▃",
    "##### ULUSAL HEVC #####",
    "===== SPOR =====",
    "---- BELGESEL ----",
    "★★★ HABER ★★★",
    "▬▬ MÜZİK ▬▬",
    "| SİNEMA |",
    "** SPOR **",
    "~~~ FILM ~~~",
    "●● YEREL",
    "KANAL ◆◆",
    "----------",
    "  ==  ",
    "#### DE ####",
    "----- SPORTS -----",
    "★ VIP ★",
    "|DE| ----",
    "◉◉◉",
    "••• FR •••",
    ">>> UK <<<",
    "»»» UK «««",
    "___ ARABIC ___",
    "┃ KIDS ┃",
    "♦ MOVIES ♦"
  ]) {
    assert.equal(isSeparatorName(name), true, name);
  }
});

test("normal channel names are not separators", () => {
  for (const name of [
    "TRT 1 HD",
    "A Spor",
    "beIN SPORTS 1 4K",
    "TV8.5",
    "NTV (Yedek)",
    "Fox+",
    "TR: b**N SP*RTS 1 | Premium+++",
    "CNN Türk",
    "Show TV *",
    "TRT Belgesel 4K",
    "|DE| Das Erste HD",
    "DE: Sky Cinema+1",
    "RTL+",
    "BBC One HD+",
    "[backup] ITV 4K*",
    "(Yedek) Kanal D",
    "Al Jazeera - Arabic",
    "Sport 1 - Extra",
    "",
    "   ",
    undefined,
    null
  ]) {
    assert.equal(isSeparatorName(name), false, String(name));
  }
});
