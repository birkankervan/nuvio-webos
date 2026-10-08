// Pure adult-content detector for IPTV category / item names (provider-agnostic).
// ponytail: keyword heuristic; providers can still mislabel. Add a PIN/allowlist if needed.
const W = "(?<![\\p{L}\\p{N}])"; // unicode word start (\b fails for Cyrillic/Arabic)
const E = "(?![\\p{L}\\p{N}])";
const CATEGORY_WORDS = [
  "x{3,}", "adults?(?!\\s+(?:swim|animation))", "porn[oa]?", "erotic[ao]?", "erotik", "erotica", "sexy?",
  "\\+\\s?18", "18\\s?\\+", "\\(18\\)", "18\\s?plus", "yetiskin(?:ler)?", "erwachsene[n]?", "adult[ie]", "adultos", "adultes?",
  "для\\s+взрослых", "взрослые", "للكبار", "للبالغين", "بالغين"
];
const CATEGORY_RE = new RegExp(`${W}(?:${CATEGORY_WORDS.join("|")})${E}`, "u");
// Items: a leading provider tag ("XXX:", "XXXX:", "|XXX|", "[XXX]", "18+:") or whole-word porn.
// Tag is case-sensitive so the film "xXx: Return of Xander Cage" is kept.
const ITEM_TAG_RE = /^[\s|[(]*(?:X{3,}|18\+|\+18)(?![\p{L}\p{N}])/u;
const ITEM_PORN_RE = new RegExp(`${W}porn${E}`, "iu");

const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").toLowerCase();

export const isAdultCategoryName = (name) => CATEGORY_RE.test(fold(name));
export const isAdultItemName = (name) => {
  const text = String(name ?? "");
  return ITEM_TAG_RE.test(text) || ITEM_PORN_RE.test(text);
};
