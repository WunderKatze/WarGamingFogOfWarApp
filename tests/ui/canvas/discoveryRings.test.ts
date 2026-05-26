import { describe, expect, it } from "vitest";
import {
  dugInStealthModifier,
  goneToGroundStealthModifier,
  modifierEffects,
  polygonStealthModifier,
  unitTypeStats,
} from "../../../src/core/config.js";
import { GameMap } from "../../../src/core/map/GameMap.js";
import { TerrainPolygon } from "../../../src/core/map/TerrainPolygon.js";
import { Infantry } from "../../../src/core/units/Infantry.js";
import { Tank } from "../../../src/core/units/Tank.js";
import {
  abstractDivisorRings,
  availableArchetypes,
  availablePostureModifiers,
  resolveLens,
  ringsForUnit,
} from "../../../src/ui/canvas/discoveryRings.js";

const p = (x: number, y: number) => ({ x, y });

const tankAt = (id: string, pos = p(0, 0), teamId = "A") =>
  new Tank({ id, name: id, teamId, position: pos });

const emptyMap = () => new GameMap({ width: 1000, height: 1000 });

describe("availablePostureModifiers", () => {
  it("always includes Open (×1) as the first entry", () => {
    const opts = availablePostureModifiers();
    expect(opts[0]).toMatchObject({ modifier: 1, label: "Open", sources: [] });
  });

  it("includes one entry per distinct cover modifier value > 1", () => {
    const opts = availablePostureModifiers();
    const mods = opts.map((o) => o.modifier);
    // No duplicates
    expect(new Set(mods).size).toBe(mods.length);
    // Every distinct cover modifier from config shows up
    const expectedCoverMods = new Set<number>([
      ...Object.values(polygonStealthModifier),
      dugInStealthModifier,
    ]);
    for (const m of expectedCoverMods) {
      if (m > 1) expect(mods).toContain(m);
    }
  });

  it("groups sources by modifier value (×2 collects Short Terrain, Dug-in, Short Wall)", () => {
    const opts = availablePostureModifiers();
    const mod2 = opts.find((o) => o.modifier === 2);
    expect(mod2).toBeDefined();
    expect(mod2!.sources).toContain("Dug-in");
    expect(mod2!.sources).toContain("Short Wall");
    expect(mod2!.sources).toContain("Short Terrain");
  });
});

describe("availableArchetypes", () => {
  it("returns one entry per unit type × Recon variant", () => {
    const list = availableArchetypes();
    expect(list.length).toBe(Object.keys(unitTypeStats).length * 2);
    expect(list.find((a) => a.unitType === "Tank" && !a.recon)).toBeDefined();
    expect(list.find((a) => a.unitType === "Tank" && a.recon)).toBeDefined();
    expect(list.find((a) => a.unitType === "Infantry" && !a.recon)).toBeDefined();
    expect(list.find((a) => a.unitType === "Infantry" && a.recon)).toBeDefined();
  });

  it("Recon variants apply the Recon vision multiplier", () => {
    const reconTank = availableArchetypes().find(
      (a) => a.unitType === "Tank" && a.recon,
    )!;
    expect(reconTank.vision).toBeCloseTo(
      unitTypeStats.Tank.baseVision * modifierEffects.Recon.visionMultiplier,
      10,
    );
  });

  it("non-Recon variants use base vision and intrinsic stealth", () => {
    const plainTank = availableArchetypes().find(
      (a) => a.unitType === "Tank" && !a.recon,
    )!;
    expect(plainTank.vision).toBe(unitTypeStats.Tank.baseVision);
    expect(plainTank.intrinsicStealth).toBe(unitTypeStats.Tank.baseStealth);
  });
});

describe("resolveLens", () => {
  it("returns null for the None / abstract archetype", () => {
    expect(resolveLens({ kind: "none" }, 1, false)).toBeNull();
  });

  it("multiplies threat stealth by posture modifier × GtG when modifier > 1", () => {
    const tank = availableArchetypes().find((a) => a.unitType === "Tank" && !a.recon)!;
    const lens = resolveLens({ kind: "unit", unitType: "Tank", recon: false }, 2, true)!;
    expect(lens.threatEffectiveStealthMultiplier).toBeCloseTo(
      tank.intrinsicStealth * 2 * goneToGroundStealthModifier,
      10,
    );
  });

  it("GtG does NOT stack when posture modifier is 1 (Open)", () => {
    const tank = availableArchetypes().find((a) => a.unitType === "Tank" && !a.recon)!;
    const lens = resolveLens({ kind: "unit", unitType: "Tank", recon: false }, 1, true)!;
    expect(lens.threatEffectiveStealthMultiplier).toBeCloseTo(tank.intrinsicStealth, 10);
  });
});

describe("ringsForUnit", () => {
  it("outgoing radius is observer.vision / threat.effective_stealth", () => {
    const observer = tankAt("o");
    const tank = availableArchetypes().find((a) => a.unitType === "Tank" && !a.recon)!;
    const lens = resolveLens({ kind: "unit", unitType: "Tank", recon: false }, 1, false)!;
    const rings = ringsForUnit(observer, p(0, 0), emptyMap(), lens);
    const outgoing = rings.find((r) => r.direction === "outgoing")!;
    expect(outgoing.radiusInches).toBeCloseTo(observer.getVision() / tank.intrinsicStealth, 10);
  });

  it("incoming radius reads observer's actual stealth at position (dug-in Infantry)", () => {
    const dugIn = new Infantry({
      id: "i", name: "i", teamId: "A", position: p(0, 0), dugIn: true,
    });
    const lens = resolveLens({ kind: "unit", unitType: "Tank", recon: false }, 1, false)!;
    const rings = ringsForUnit(dugIn, p(0, 0), emptyMap(), lens);
    const incoming = rings.find((r) => r.direction === "incoming")!;
    expect(incoming.radiusInches).toBeCloseTo(
      unitTypeStats.Tank.baseVision /
        (unitTypeStats.Infantry.baseStealth * dugInStealthModifier),
      10,
    );
  });

  it("outgoing GtG stacks when posture modifier > 1, does not when Open", () => {
    const obs = tankAt("o");
    const lensOpenGtg = resolveLens({ kind: "unit", unitType: "Tank", recon: false }, 1, true)!;
    const outOpen = ringsForUnit(obs, p(0, 0), emptyMap(), lensOpenGtg)
      .find((r) => r.direction === "outgoing")!;
    // Open + GtG: stealth = 1 → range = full vision
    expect(outOpen.radiusInches).toBeCloseTo(obs.getVision(), 10);

    const lensCoverGtg = resolveLens({ kind: "unit", unitType: "Tank", recon: false }, 2, true)!;
    const outCover = ringsForUnit(obs, p(0, 0), emptyMap(), lensCoverGtg)
      .find((r) => r.direction === "outgoing")!;
    // ×2 cover + GtG (×2): threat stealth = 1 × 2 × 2 = 4
    expect(outCover.radiusInches).toBeCloseTo(obs.getVision() / 4, 10);
  });

  it("incoming GtG stacks when observer is in cover terrain", () => {
    const cover = new TerrainPolygon({
      id: "s",
      vertices: [p(-5, -5), p(5, -5), p(5, 5), p(-5, 5)],
      terrainType: "ShortTerrain",
    });
    const map = new GameMap({ width: 100, height: 100, polygons: [cover] });
    const obs = tankAt("o");
    obs.goneToGround = true;

    const lens = resolveLens({ kind: "unit", unitType: "Tank", recon: false }, 1, false)!;
    const incoming = ringsForUnit(obs, p(0, 0), map, lens)
      .find((r) => r.direction === "incoming")!;
    expect(incoming.radiusInches).toBeCloseTo(
      unitTypeStats.Tank.baseVision /
        (1 * polygonStealthModifier.ShortTerrain * goneToGroundStealthModifier),
      10,
    );
  });

  it("returns exactly one incoming and one outgoing ring", () => {
    const lens = resolveLens({ kind: "unit", unitType: "Tank", recon: false }, 1, false)!;
    const rings = ringsForUnit(tankAt("o"), p(0, 0), emptyMap(), lens);
    expect(rings.filter((r) => r.direction === "incoming")).toHaveLength(1);
    expect(rings.filter((r) => r.direction === "outgoing")).toHaveLength(1);
  });

  // Move-preview override (vision-rules-tweaks §2.1 + vision-recon-tweaks §2.2).
  it("treatAsJustMoved: true skips inherent dug-in on the incoming ring", () => {
    const dugIn = new Infantry({ id: "i", name: "i", teamId: "A", position: p(0, 0), dugIn: true });
    const lens = resolveLens({ kind: "unit", unitType: "Tank", recon: false }, 1, false)!;
    const previewRings = ringsForUnit(
      dugIn, p(0, 0), emptyMap(), lens, undefined, { treatAsJustMoved: true },
    );
    const incoming = previewRings.find((r) => r.direction === "incoming")!;
    // No dug-in → effective stealth is just Infantry intrinsic.
    expect(incoming.radiusInches).toBeCloseTo(
      unitTypeStats.Tank.baseVision / unitTypeStats.Infantry.baseStealth,
      10,
    );
  });

  it("treatAsJustMoved: true skips GtG on the incoming ring for a non-Recon unit", () => {
    const cover = new TerrainPolygon({
      id: "s",
      vertices: [p(-5, -5), p(5, -5), p(5, 5), p(-5, 5)],
      terrainType: "ShortTerrain",
    });
    const map = new GameMap({ width: 100, height: 100, polygons: [cover] });
    const obs = tankAt("o");
    obs.goneToGround = true;

    const lens = resolveLens({ kind: "unit", unitType: "Tank", recon: false }, 1, false)!;
    const previewIncoming = ringsForUnit(
      obs, p(0, 0), map, lens, undefined, { treatAsJustMoved: true },
    ).find((r) => r.direction === "incoming")!;
    // GtG dropped on preview → stealth = Tank intrinsic × ShortTerrain (no GtG stack)
    expect(previewIncoming.radiusInches).toBeCloseTo(
      unitTypeStats.Tank.baseVision / (1 * polygonStealthModifier.ShortTerrain),
      10,
    );
  });

  it("treatAsJustMoved: true KEEPS GtG for a Recon unit (Recon-keeps-GtG-on-move)", () => {
    const cover = new TerrainPolygon({
      id: "s",
      vertices: [p(-5, -5), p(5, -5), p(5, 5), p(-5, 5)],
      terrainType: "ShortTerrain",
    });
    const map = new GameMap({ width: 100, height: 100, polygons: [cover] });
    const obs = new Tank({ id: "r", name: "r", teamId: "A", position: p(0, 0), modifiers: ["Recon"] });
    obs.goneToGround = true;

    const lens = resolveLens({ kind: "unit", unitType: "Tank", recon: false }, 1, false)!;
    const previewIncoming = ringsForUnit(
      obs, p(0, 0), map, lens, undefined, { treatAsJustMoved: true },
    ).find((r) => r.direction === "incoming")!;
    // Recon keeps GtG → stealth = intrinsic × ShortTerrain × GtG
    expect(previewIncoming.radiusInches).toBeCloseTo(
      unitTypeStats.Tank.baseVision /
        (1 * polygonStealthModifier.ShortTerrain * goneToGroundStealthModifier),
      10,
    );
  });
});

describe("abstractDivisorRings", () => {
  it("returns outgoing-only rings", () => {
    const rings = abstractDivisorRings(tankAt("o"));
    expect(rings.every((r) => r.direction === "outgoing")).toBe(true);
  });

  it("includes every reachable divisor (posture mods + GtG stacks)", () => {
    const rings = abstractDivisorRings(tankAt("o"));
    const divisors = rings.map((r) => r.divisor!);
    // With current rules: postures yield {1, 2, 3}; GtG stacks → adds {4, 6}
    expect(divisors).toEqual([1, 2, 3, 4, 6]);
  });

  it("each ring's radius is observer.vision / divisor", () => {
    const obs = tankAt("o");
    for (const r of abstractDivisorRings(obs)) {
      expect(r.radiusInches).toBeCloseTo(obs.getVision() / r.divisor!, 10);
    }
  });
});
