import { describe, expect, it } from "vitest";
import { dugInStealthModifier, modifierEffects, unitTypeStats } from "../../../src/core/config.js";
import { Infantry } from "../../../src/core/units/Infantry.js";

const at = (x: number, y: number) => ({ x, y });

describe("Infantry", () => {
  it("uses Infantry base stats from config", () => {
    const u = new Infantry({ id: "1", name: "1st Pl", position: at(0, 0) });
    expect(u.getVision()).toBe(unitTypeStats.Infantry.baseVision);
    expect(u.getIntrinsicStealth()).toBe(unitTypeStats.Infantry.baseStealth);
  });

  it("Recon scales vision by the configured Recon vision multiplier", () => {
    const plain = new Infantry({ id: "1", name: "Plain", position: at(0, 0) });
    const recon = new Infantry({ id: "2", name: "Recon", position: at(0, 0), modifiers: ["Recon"] });
    expect(recon.getVision()).toBeCloseTo(
      plain.getVision() * modifierEffects.Recon.visionMultiplier, 10,
    );
  });

  it("Recon scales intrinsic stealth by the configured Recon stealth multiplier", () => {
    const plain = new Infantry({ id: "1", name: "Plain", position: at(0, 0) });
    const recon = new Infantry({ id: "2", name: "Recon", position: at(0, 0), modifiers: ["Recon"] });
    expect(recon.getIntrinsicStealth()).toBeCloseTo(
      plain.getIntrinsicStealth() * modifierEffects.Recon.stealthMultiplier, 10,
    );
  });

  it("contributes the configured dug-in stealth modifier when dug in", () => {
    const u = new Infantry({ id: "1", name: "Foxhole", position: at(0, 0), dugIn: true });
    expect(u.dugIn).toBe(true);
    expect(u.getInherentConcealmentModifier()).toBe(dugInStealthModifier);
  });

  it("contributes a concealment modifier of 1 when not dug in", () => {
    const u = new Infantry({ id: "1", name: "Standing", position: at(0, 0) });
    expect(u.dugIn).toBe(false);
    expect(u.getInherentConcealmentModifier()).toBe(1);
  });

  it("dug-in is toggleable", () => {
    const u = new Infantry({ id: "1", name: "Inf", position: at(0, 0) });
    u.setDugIn(true);
    expect(u.dugIn).toBe(true);
    expect(u.getInherentConcealmentModifier()).toBe(dugInStealthModifier);
    u.setDugIn(false);
    expect(u.dugIn).toBe(false);
    expect(u.getInherentConcealmentModifier()).toBe(1);
  });

  it("position is mutable through setPosition", () => {
    const u = new Infantry({ id: "1", name: "Mover", position: at(1, 2) });
    u.setPosition(at(10, 20));
    expect(u.getPosition()).toEqual({ x: 10, y: 20 });
  });

  it("type discriminator is 'Infantry'", () => {
    const u = new Infantry({ id: "1", name: "Pl", position: at(0, 0) });
    expect(u.type).toBe("Infantry");
  });
});
