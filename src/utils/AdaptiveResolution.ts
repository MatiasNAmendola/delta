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

/**
 * Default policy: never above 2x pixel ratio. On phones never below the CSS
 * resolution: below it everything turns to mush on a small, sharp screen
 * (trees look like flat smudges), so a slow phone sheds detail elsewhere.
 * On desktops, down to 2/3 of it. With a 30 fps cap the thresholds follow
 * the cap, or the resolution would never sharpen again.
 */
export function defaultPolicy(devicePixelRatio: number, isTouch: boolean, fpsCap = 60): ResolutionPolicy {
  return {
    minLevel: round(1 / Math.min(Math.max(devicePixelRatio, 1), 2)),
    maxLevel: isTouch ? 1 : 1.5,
    step: 0.25,
    lowFps: fpsCap <= 30 ? 24 : 28,
    highFps: fpsCap <= 30 ? 29 : 55,
    windowsBeforeSharpen: 3,
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
