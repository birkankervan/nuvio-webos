import test from "node:test";
import assert from "node:assert/strict";
import { isAdultCategoryName as C, isAdultItemName as I } from "./iptvAdultFilter.js";

test("category positives across languages", () => {
  for (const n of ["XXX", "XXXX", "FOR ADULTS ➾ PORNO", "ADULTS CHANNELS", "18+ Filmler", "DIZI (18)", "+18", "Yetişkin Filmleri", "YETİŞKİN", "TR | Yetiskin", "Erotik", "Erwachsene", "Для взрослых", "Sexy Hot", "للكبار"]) {
    assert.equal(C(n), true, n);
  }
});

test("category false-positive traps", () => {
  for (const n of ["Sussex", "Essex", "sextet", "Adult Swim", "Pornhub", "Kids 18 Dogs", "News", "TR ➾ Yerli Diziler", "Yetiş"]) {
    assert.equal(C(n), false, n);
  }
});

test("item tags and whole-word porn", () => {
  for (const n of ["XXX: Alba 1", "XXXX: PORNBOX X", "|XXX| foo", "[XXX] x", "18+: abc", "GERMAN PORN 01"]) assert.equal(I(n), true, n);
  for (const n of ["xXx: Return of Xander Cage", "MaXXXine", "Pornhub'ın Milyar Dolarlık Hikâyesi", "Sex Education", "Haz | 2021 | +18 |", "Essex Serpent", ""]) {
    assert.equal(I(n), false, n);
  }
});
