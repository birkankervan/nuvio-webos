import { test } from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { streamRepository } = await import('../../../data/repository/streamRepository.js');
const { StreamBadgeSettingsStore } = await import('../../../data/local/streamBadgeSettingsStore.js');
const { createStreamScreenMethods04 } = await import('./streamScreenMethods-04-load-streams.js');
const { createStreamScreenMethods11 } = await import('./streamScreenMethods-11-cleanup.js');

const group = (id) => ({ addonName: `addon-${id}`, streams: [{ id, url: `https://example.invalid/${id}` }] });
function context() {
  const ctx = {
    ...createStreamScreenMethods04(),
    ...createStreamScreenMethods11(),
    loadToken: 0, params: { itemType: 'movie', itemId: 'test' }, streams: [],
    container: { style: {}, childNodes: [] },
    requestRender() {}, scheduleDebridPreparation() {}, maybeAutoResumeStream() {},
    maybeAutoPlayStream() {}, scheduleErrorChipCleanup() {},
    cancelAutoPlayCountdown() {}, cancelAutoPlaySelectionWait() {},
    cancelScheduledRender() {}, stopStreamVirtualization() {},
    applyAddonLogos: (streams) => streams,
    getFilteredStreams: () => ctx.streams
  };
  return ctx;
}

test('repeated source groups in a chunk or final result keep one chip per source name', async () => {
  const originalGet = streamRepository.getStreamsFromAllAddons;
  const originalSnapshot = StreamBadgeSettingsStore.snapshot;
  const groups = [group('one'), group('two'), group('three')];
  groups[0].addonName = groups[1].addonName = 'same-source';
  try {
    StreamBadgeSettingsStore.snapshot = () => ({ showAddonLogo: false, rules: { imports: [] } });
    streamRepository.getStreamsFromAllAddons = async (_type, _id, options) => {
      options.onChunk({ status: 'success', data: groups });
      return { status: 'success', data: groups };
    };
    const ctx = context();
    await ctx.loadStreams();
    assert.deepEqual(ctx.sourceChips.map(chip => chip.name), ['same-source', 'addon-three']);
    assert.equal(ctx.streams.length, 3, 'all distinct stream choices must remain available');
    streamRepository.getStreamsFromAllAddons = async () => ({ status: 'success', data: groups });
    await ctx.loadStreams();
    assert.deepEqual(ctx.sourceChips.map(chip => chip.name), ['same-source', 'addon-three'], 'final-only sources also deduplicate');
  } finally {
    streamRepository.getStreamsFromAllAddons = originalGet;
    StreamBadgeSettingsStore.snapshot = originalSnapshot;
  }
});

test('first source publishes immediately; later chunks merge in one batch; stale producers are ignored', async () => {
  const originalGet = streamRepository.getStreamsFromAllAddons;
  const originalSnapshot = StreamBadgeSettingsStore.snapshot;
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  const requests = [];
  const timers = new Map();
  let timerId = 0;
  try {
    StreamBadgeSettingsStore.snapshot = () => ({ showAddonLogo: false, rules: { imports: [] } });
    streamRepository.getStreamsFromAllAddons = (type, id, options) => new Promise((resolve, reject) => requests.push({ options, resolve, reject }));
    globalThis.setTimeout = callback => { const id = ++timerId; timers.set(id, callback); return id; };
    globalThis.clearTimeout = id => timers.delete(id);
    const ctx = context();
    const firstLoad = ctx.loadStreams();
    requests[0].options.onChunk({ status: 'success', data: [group('first')] });
    assert.equal(ctx.streams.length, 1);
    requests[0].options.onChunk({ status: 'success', data: [group('second')] });
    requests[0].options.onChunk({ status: 'success', data: [group('third')] });
    assert.equal(ctx.streams.length, 1);
    assert.equal(timers.size, 1);
    const flush = timers.get(ctx.streamChunkTimer);
    timers.delete(ctx.streamChunkTimer);
    flush();
    assert.deepEqual(ctx.streams.map(s => s.id), ['first', 'second', 'third']);
    requests[0].options.onChunk({ status: 'success', data: [group('pending-old')] });
    const secondLoad = ctx.loadStreams();
    assert.equal(requests[0].options.signal.aborted, true);
    assert.equal(timers.size, 0);
    requests[0].options.onChunk({ status: 'success', data: [group('late-old')] });
    assert.equal(ctx.streams.length, 0);
    requests[1].options.onChunk({ status: 'success', data: [group('new')] });
    requests[1].options.onChunk({ status: 'success', data: [group('new-pending')] });
    const newTimer = ctx.streamChunkTimer;
    requests[0].reject(new Error('old aborted request'));
    await firstLoad;
    assert.equal(ctx.streamChunkTimer, newTimer);
    assert.equal(timers.has(newTimer), true, 'old rejection must not cancel new batch');
    requests[1].resolve({ status: 'success', data: [group('new'), group('new-pending')] });
    await secondLoad;
    assert.deepEqual(ctx.streams.map(s => s.id), ['new', 'new-pending']);
    assert.equal(ctx.streamSearchCompleted, true);
    assert.equal(ctx.streamLoadAbortController, null);
    ctx.debridPreparationTimer = setTimeout(() => assert.fail('late debrid work'));
    ctx.debridPreparationScheduled = true;
    ctx.cleanup();
    assert.equal(timers.size, 0);
    assert.equal(ctx.debridPreparationScheduled, false);
    assert.deepEqual(ctx.streams, []);
    assert.equal(ctx.params, null);
  } finally {
    streamRepository.getStreamsFromAllAddons = originalGet;
    StreamBadgeSettingsStore.snapshot = originalSnapshot;
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
  }
});
