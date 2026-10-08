// Class by the larger of width/height tier so letterboxed crops (3840x1600) still read as 4K.
export function videoResolutionLabel(width, height) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w <= 0 || h <= 0) {
    return "";
  }
  if (w >= 3200 || h >= 2000) {
    return "4K";
  }
  if (w >= 1900 || h >= 1000) {
    return "1080p";
  }
  if (w >= 1200 || h >= 700) {
    return "720p";
  }
  return `${Math.round(h)}p`;
}
