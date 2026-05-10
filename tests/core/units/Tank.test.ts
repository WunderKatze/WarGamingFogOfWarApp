import { describe, expect, it } from "vitest";
import { modifierEffects, unitTypeStats } from "../../../src/core/config.js";
import { Tank } from "../../../src/core/units/Tank.js";

const at = (x: number, y: number) => ({ x, y });

describe("Tank", () => {
  it("uses Tank base stats from config", () => {
    const t = new Tank({ id: "1", name: "M4", position: at(0, 0) });
    expect(t.getVision()).toBe(unitTypeStats.Tank.baseVision);
    expect(t.getIntrinsicStealth()).toBe(unitTypeStats.Tank.baseStealth);
  });

  it("Recon scales Tank stats by the configured Recon multipliers", () => {
    const plain = new Tank({ id: "1", name: "M4", position: at(0, 0) });
    const recon = new Tank({ id: "2", name: "Recon M4", position: at(0, 0), modifiers: ["Recon"] });
    expect(recon.getVision()).toBeCloseTo(
      plain.getVision() * modifierEffects.Recon.visionMultiplier, 10,
    );
    expect(recon.getIntrinsicStealth()).toBeCloseTo(
      plain.getIntrinsicStealth() * modifierEffects.Recon.stealthMultiplier, 10,
    );
  });

  it("contributes a concealment modifier of 1 (tanks have no inherent concealment)", () => {
    const t = new Tank({ id: "1", name: "M4", position: at(0, 0) });
    expect(t.getInherentConcealmentModifier()).toBe(1);
  });

  it("type discriminator is 'Tank'", () => {
    const t = new Tank({ id: "1", name: "M4", position: at(0, 0) });
    expect(t.type).toBe("Tank");
  });
});
