/**
 * Keeps the frame rate playable on cheap phones by lowering the render
 * resolution when FPS drops, and raising it back slowly when there is room.
 *
 * Babylon's "hardware scaling level" is the inverse of the pixel ratio:
 * 0.5 = render at 2x the CSS size, 1 = CSS size, 1.5 = below CSS size.
 */
export interface ResolutionPolicy {
  /** Sharpest allowed level (e.g. 1 / devicePixelRatio). */
  minLevel: number;
  /** Blurriest allowed level. */
  maxLevel: number;
  step: number;
  lowFps: number;
  highFps: number;
  /** Consecutive good windows required before sharpening again. */
  windowsBeforeSharpen: number;
}

export interface ResolutionState {
  level: number;
  goodWindows: number;
}

/** Pure decision step, run once per measurement window. */
export function nextResolution(
  state: ResolutionState,
  fps: number,
  policy: ResolutionPolicy
): ResolutionState {
  if (fps < policy.lowFps && state.level < policy.maxLevel) {
    return { level: Math.min(policy.maxLevel, round(state.level + policy.step)), goodWindows: 0 };
  }
  if (fps > policy.highFps && state.level > policy.minLevel) {
    const goodWindows = state.goodWindows + 1;
    if (goodWindows >= policy.windowsBeforeSharpen) {
      return { level: Math.max(policy.minLevel, round(state.level - policy.step)), goodWindows: 0 };
    }
    return { level: state.level, goodWindows };
  }
  return { level: state.level, goodWindows: 0 };
}

/** Default policy: never above 2x pixel ratio (1.5x on touch devices). */
export function defaultPolicy(devicePixelRatio: number, isTouch: boolean): ResolutionPolicy {
  const maxRatio = isTouch ? 1.5 : 2;
  return {
    minLevel: round(1 / Math.min(Math.max(devicePixelRatio, 1), maxRatio)),
    maxLevel: 1.5,
    step: 0.25,
    lowFps: 28,
    highFps: 55,
    windowsBeforeSharpen: 3,
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
