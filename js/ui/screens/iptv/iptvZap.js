import { isSeparatorName } from "./iptvCards.js";

// CH+ / CH- : 33/34 webOS + browser PageUp/PageDown, 427/428 Tizen ChannelUp/ChannelDown.
export function zapDirection(keyCode) {
  if (keyCode === 33 || keyCode === 427) return 1;
  if (keyCode === 34 || keyCode === 428) return -1;
  return 0;
}

// Next/previous playable channel, wrapping, skipping separator rows. null when unknown or alone.
export function neighborChannel(list, channelId, direction) {
  const size = Array.isArray(list) ? list.length : 0;
  const from = size ? list.findIndex((channel) => channel.id === channelId) : -1;
  if (from < 0) return null;
  for (let step = 1; step < size; step += 1) {
    const channel = list[(from + direction * step + size * step) % size];
    if (!isSeparatorName(channel.name)) return channel;
  }
  return null;
}
