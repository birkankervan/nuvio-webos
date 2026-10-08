import test from "node:test";
import assert from "node:assert/strict";
import {
  DZONE,
  captureDetailState,
  formatClock,
  formatReleaseDate,
  movieActions,
  moveDetailFocus,
  pickDefaultEpisode,
  releaseYear,
  resolveDetailFocus,
  seasonLabel
} from "./iptvDetail.js";

const seasons = [
  { number: 1, name: "Season 1", episodes: [{ id: "a" }, { id: "b" }] },
  { number: 2, name: "Final", episodes: [{ id: "c" }, { id: "d" }, { id: "e" }] }
];

test("season label localizes provider default, keeps custom names", () => {
  const fmt = (n) => `Sezon ${n}`;
  assert.equal(seasonLabel(seasons[0], fmt), "Sezon 1");
  assert.equal(seasonLabel(seasons[1], fmt), "Final");
  assert.equal(seasonLabel({ number: 4, name: "" }, fmt), "Sezon 4");
});

test("movie actions and clock", () => {
  assert.deepEqual(movieActions(null).map((a) => a.action), ["play"]);
  assert.deepEqual(movieActions({ posMs: 83000 }).map((a) => a.action), ["resume", "restart"]);
  assert.equal(formatClock(83000), "1:23");
  assert.equal(formatClock(3723000), "1:02:03");
  assert.equal(releaseYear("2021-05-04"), "2021");
  assert.equal(releaseYear(""), "");
});

test("default episode: latest touched season, first episode with progress", () => {
  const progress = { b: { updatedAt: 5 }, d: { updatedAt: 9 }, e: { updatedAt: 3 } };
  const get = (episode) => progress[episode.id] || null;
  assert.deepEqual(pickDefaultEpisode(seasons, get), { season: 1, episode: 1 });
  assert.deepEqual(pickDefaultEpisode(seasons, () => null), { season: 0, episode: 0 });
  delete progress.d;
  assert.deepEqual(pickDefaultEpisode(seasons, get), { season: 0, episode: 1 });
});

test("detail route state round trip", () => {
  const detail = { kind: "series", item: { id: "9", name: "X" }, seasons, focus: { zone: DZONE.EPISODES, season: 1, episode: 2 } };
  const saved = captureDetailState(detail);
  assert.deepEqual(saved, { kind: "series", item: detail.item, season: 2, episodeId: "e" });
  assert.deepEqual(resolveDetailFocus(seasons, saved), { season: 1, episode: 2 });
  assert.deepEqual(resolveDetailFocus(seasons, { season: 7 }), { season: 0, episode: 0 });
  assert.equal(captureDetailState(null), null);
});

test("detail focus moves between buttons, seasons and episodes", () => {
  const ctx = { buttonCount: 2, seasonCount: 3, episodeCount: 121 };
  const at = (zone, patch = {}) => ({ zone, button: 0, season: 0, episode: 0, ...patch });
  assert.equal(moveDetailFocus(at(DZONE.BUTTONS), "right", ctx).focus.button, 1);
  assert.equal(moveDetailFocus(at(DZONE.BUTTONS, { button: 1 }), "right", ctx).focus.button, 1);
  assert.equal(moveDetailFocus(at(DZONE.BUTTONS), "down", ctx).focus.zone, DZONE.SEASONS);
  const r = moveDetailFocus(at(DZONE.SEASONS, { episode: 5 }), "right", ctx);
  assert.deepEqual([r.focus.season, r.focus.episode, r.seasonChanged], [1, 0, true]);
  assert.equal(moveDetailFocus(at(DZONE.SEASONS), "left", ctx).seasonChanged, false);
  assert.equal(moveDetailFocus(at(DZONE.SEASONS), "down", ctx).focus.zone, DZONE.EPISODES);
  assert.equal(moveDetailFocus(at(DZONE.EPISODES, { episode: 119 }), "down", ctx).focus.episode, 120);
  assert.equal(moveDetailFocus(at(DZONE.EPISODES, { episode: 120 }), "down", ctx).focus.episode, 120);
  assert.equal(moveDetailFocus(at(DZONE.EPISODES), "up", ctx).focus.zone, DZONE.SEASONS);
  assert.equal(moveDetailFocus(at(DZONE.SEASONS), "up", { ...ctx, buttonCount: 0 }).focus.zone, DZONE.SEASONS);
  assert.equal(moveDetailFocus(at(DZONE.BUTTONS), "down", { buttonCount: 1 }).focus.zone, DZONE.BUTTONS);
});

import { plotSizeClass } from "./iptvDetail.js";
test("plotSizeClass steps down with length", () => {
  assert.equal(plotSizeClass(""), "plot-lg");
  assert.equal(plotSizeClass("x".repeat(800)), "plot-md");
  assert.equal(plotSizeClass("x".repeat(1200)), "plot-sm");
  assert.equal(plotSizeClass("x".repeat(2000)), "plot-xs");
});

test("release date localizes ISO dates, keeps years and garbage", () => {
  assert.equal(formatReleaseDate("2024-11-11", "tr-TR"), "11.11.2024");
  assert.equal(formatReleaseDate("2024", "tr-TR"), "2024");
  assert.equal(formatReleaseDate("", "tr-TR"), "");
  assert.equal(formatReleaseDate("soon", "tr-TR"), "soon");
});
