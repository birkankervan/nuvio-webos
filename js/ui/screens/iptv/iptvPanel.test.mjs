import test from "node:test";
import assert from "node:assert/strict";
import {
  advancePastWatched,
  episodePlayerTitle,
  formatClockTime,
  formatEpisodeDuration,
  pickNextEpisode
} from "./iptvDetail.js";
import { ZONE, createFocus, moveFocus, nearestSelectable } from "./iptvNavigation.js";

const seasons = [
  { number: 1, episodes: [{ id: "a" }, { id: "b" }] },
  { number: 2, episodes: [] },
  { number: 3, episodes: [{ id: "c" }] }
];

test("next episode crosses seasons, skips empty ones, ends at null", () => {
  assert.deepEqual(pickNextEpisode(seasons, 0, 0), { season: 0, episode: 1 });
  assert.deepEqual(pickNextEpisode(seasons, 0, 1), { season: 2, episode: 0 });
  assert.equal(pickNextEpisode(seasons, 2, 0), null);
});

test("selection advances only past watched episodes", () => {
  const watched = new Set(["b"]);
  const is = (episode) => watched.has(episode.id);
  assert.deepEqual(advancePastWatched(seasons, { season: 0, episode: 1 }, is), {
    season: 2,
    episode: 0
  });
  assert.deepEqual(advancePastWatched(seasons, { season: 0, episode: 0 }, is), {
    season: 0,
    episode: 0
  });
  watched.add("c");
  assert.deepEqual(advancePastWatched(seasons, { season: 2, episode: 0 }, is), {
    season: 2,
    episode: 0
  });
});

test("episode title and duration formats", () => {
  assert.equal(episodePlayerTitle("Dark", 1, 2, "Lies"), "Dark · S01E02 · Lies");
  assert.equal(episodePlayerTitle("Dark", 1, 2, "dark"), "Dark · S01E02");
  assert.equal(episodePlayerTitle("Dark", 12, 10, ""), "Dark · S12E10");
  assert.equal(formatEpisodeDuration(45 * 60), "45m");
  assert.equal(formatEpisodeDuration(65 * 60), "1:05");
  assert.equal(formatEpisodeDuration(0), "");
  assert.match(formatClockTime(Date.now()), /^\d\d:\d\d$/);
});

test("separator rows are skipped by up/down and selection lands on a real row", () => {
  const skipped = new Set([0, 3, 4]);
  const isSkipped = (i) => skipped.has(i);
  const ctx = { headerCount: 3, categoryCount: 2, channelCount: 6, columns: 1, isSkipped };
  const at = (channel) => createFocus({ zone: ZONE.GRID, channel });
  assert.equal(moveFocus(at(2), "down", ctx).focus.channel, 5);
  assert.equal(moveFocus(at(5), "up", ctx).focus.channel, 2);
  assert.equal(moveFocus(at(1), "up", ctx).focus.zone, ZONE.HEADER, "only a header above");
  assert.equal(moveFocus(at(5), "down", ctx).focus.channel, 5);
  assert.equal(nearestSelectable(6, 0, isSkipped), 1);
  assert.equal(nearestSelectable(6, 3, isSkipped), 5);
  assert.equal(
    nearestSelectable(3, 0, () => true),
    -1
  );
});

test("items hand off to the panel and back", () => {
  const ctx = { headerCount: 3, categoryCount: 2, channelCount: 6, columns: 1, panelCount: 1 };
  const grid = createFocus({ zone: ZONE.GRID, channel: 2 });
  assert.equal(moveFocus(grid, "right", ctx).focus.zone, ZONE.PANEL);
  assert.equal(moveFocus(grid, "right", { ...ctx, panelCount: 0 }).focus.zone, ZONE.GRID);
  const panel = createFocus({ zone: ZONE.PANEL, channel: 2 });
  assert.equal(moveFocus(panel, "left", ctx).focus.zone, ZONE.GRID);
});
