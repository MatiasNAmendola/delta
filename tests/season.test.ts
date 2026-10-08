import { describe, expect, it } from "vitest";
import { leafTint, seasonFor } from "../src/world/season";

describe("season", () => {
  it("follows the southern hemisphere", () => {
    expect(seasonFor(new Date(2026, 9, 8), "")).toBe("primavera");
    expect(seasonFor(new Date(2026, 0, 10), "")).toBe("verano");
    expect(seasonFor(new Date(2026, 4, 1), "")).toBe("otono");
    expect(seasonFor(new Date(2026, 6, 20), "")).toBe("invierno");
    expect(seasonFor(new Date(2026, 6, 20), "?estacion=otono")).toBe("otono");
  });

  it("poplars turn yellow in autumn and lose their leaves in winter; casuarinas stay green", () => {
    const autumn = leafTint("alamo", "otono", 0.5)!;
    expect(autumn[0]).toBeGreaterThan(autumn[2] * 2);
    expect(leafTint("alamo", "invierno", 0.3)).toBeNull();
    expect(leafTint("casuarina", "invierno", 0.3)).not.toBeNull();
  });
});
