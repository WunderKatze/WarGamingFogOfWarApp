import { GameMap } from "./map/GameMap.js";
import { distance } from "./map/geometry.js";
import { Unit } from "./units/Unit.js";

export class VisionCalculator {
  constructor(public readonly gameMap: GameMap) {}

  /**
   * Geometric line-of-sight check (the "See" relation in the requirements).
   * True if the ray from the observer's position to the target's position is
   * not interrupted by any sight-blocking terrain rule. Distance and stealth
   * are NOT considered.
   */
  see(observer: Unit, target: Unit): boolean {
    return !this.gameMap.isRayBlocked(observer.getPosition(), target.getPosition());
  }

  /**
   * Distance- and stealth-aware detection (the "Discover" relation in the
   * requirements). True iff:
   *   - see(observer, target) is true, AND
   *   - distance(observer, target) <= observer.vision / target.effective_stealth
   *
   * effective_stealth = target.intrinsicStealth × max(applicable concealment modifiers)
   * where the pool of modifiers comprises every terrain modifier along the ray and
   * the target's own inherent concealment (e.g. dug-in). Only the single highest
   * applies — modifiers do not stack.
   */
  discover(observer: Unit, target: Unit): boolean {
    if (!this.see(observer, target)) return false;

    const observerPos = observer.getPosition();
    const targetPos = target.getPosition();

    const terrainMods = this.gameMap.getConcealmentModifiersAlongRay(observerPos, targetPos);
    const inherentMod = target.getInherentConcealmentModifier();
    const highestMod = Math.max(1, inherentMod, ...terrainMods);

    const effectiveStealth = target.getIntrinsicStealth() * highestMod;
    const visionRange = observer.getVision() / effectiveStealth;

    return distance(observerPos, targetPos) <= visionRange;
  }
}
