import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { createMetaDetailsScreenMethods04 } = await import("./metaDetailsScreenMethods-04-fetch-more-like-this.js");
const { TraktSettingsStore, TraktAuthService } = await import("./metaDetailsScreenContext.js");

test("same comments target loads page 1 once; changed target, force and failure reload", async () => {
  const savedGet = TraktSettingsStore.get;
  const savedAuth = TraktAuthService.isAuthenticated;
  TraktSettingsStore.get = () => ({ showMetaComments: true });
  TraktAuthService.isAuthenticated = () => true;
  try {
    const fetches = [];
    const aborted = [];
    let fail = false;
    let path = "/movies/1";
    const ctx = {
      ...createMetaDetailsScreenMethods04(),
      meta: { id: "tt1" },
      detailLoadToken: 1,
      commentsMode: "title",
      commentsItems: [],
      supportsTraktComments: () => true,
      resolveTraktCommentsTarget: () => ({ path }),
      updateRenderedDetailSections() {},
      fetchTraktCommentsPage: async (page, { target, signal }) => {
        fetches.push(target.path);
        signal?.addEventListener("abort", () => aborted.push(target.path));
        if (fail) throw new Error("boom");
        return { items: [{ id: fetches.length }], page, pageCount: 1 };
      }
    };
    const pending = ctx.loadTraktComments();
    await ctx.loadTraktComments(); // enrichment pass while base request is pending
    await pending;
    await ctx.loadTraktComments(); // after load
    assert.deepEqual(fetches, ["/movies/1"]);
    assert.deepEqual(aborted, []);

    path = "/movies/2"; // enrichment changed the ids
    await ctx.loadTraktComments();
    assert.deepEqual(fetches, ["/movies/1", "/movies/2"]);

    await ctx.loadTraktComments({ force: true }); // retry / mode switch
    assert.equal(fetches.length, 3);

    fail = true;
    ctx.detailLoadToken = 2;
    await ctx.loadTraktComments();
    fail = false;
    await ctx.loadTraktComments(); // a failed page 1 may be retried without force
    assert.equal(fetches.length, 5);
    assert.equal(ctx.commentsError, "");
  } finally {
    TraktSettingsStore.get = savedGet;
    TraktAuthService.isAuthenticated = savedAuth;
  }
});
