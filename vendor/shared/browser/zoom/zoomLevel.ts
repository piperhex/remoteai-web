export const zoomLevels = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500];
export const defaultZoom = 100;
export const zoomHintDuration = 2000;
export type ZoomStep = -1 | 0 | 1;

export function nextZoom(percent: number, step: ZoomStep) {
  if (!step) return defaultZoom;
  if (step > 0) return zoomLevels.find(level => level > percent) ?? zoomLevels[zoomLevels.length - 1];
  const index = zoomLevels.findIndex(level => level >= percent);
  return index < 0 ? zoomLevels[zoomLevels.length - 1] : zoomLevels[Math.max(0, index - 1)];
}
