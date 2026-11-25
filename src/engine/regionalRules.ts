import { REGION_ORDER, REGIONS, SPECIAL_RULE_INFO, TRADE_RULE_INFO } from '../data/regions';
import type { RegionId, RegionState, SpecialRule, TradeRule } from '../types/tripleTriad';

const TRADE_RULE_LADDER: readonly TradeRule[] = ['one', 'diff', 'direct', 'all'];

export function isRuleVisibleInPreview(
  rule: SpecialRule,
  regionRules: readonly SpecialRule[],
): boolean {
  if (rule === 'sameWall') {
    return regionRules.includes('same');
  }
  return true;
}

export function getVisibleRules(regionRules: readonly SpecialRule[]): SpecialRule[] {
  return regionRules.filter((rule) => isRuleVisibleInPreview(rule, regionRules));
}

export function canOfferRuleMix(
  carriedRules: readonly SpecialRule[],
  targetRegionRules: readonly SpecialRule[],
): boolean {
  const targetSet = new Set(targetRegionRules);
  return carriedRules.some((r) => !targetSet.has(r));
}

export interface RuleMixOutcome {
  kind: 'spread' | 'abolish' | 'none';
  rule: SpecialRule | null;
  updatedRegionRules: SpecialRule[];
  message: string;
}

/**
 * Faithful PS1 FF8 Mixed Rules resolution:
 * When playing with carried rules from another region, accepting the mix can:
 * - Spread one carried rule not yet present in the target region (~35%)
 * - Abolish one rule currently in the target region (~25%)
 * - Leave regional rules unchanged (~40%)
 */
export function resolveRuleMixOutcome(
  carriedRules: readonly SpecialRule[],
  targetRegionRules: readonly SpecialRule[],
  rng: () => number = Math.random,
): RuleMixOutcome {
  const targetSet = new Set(targetRegionRules);
  const spreadable = carriedRules.filter((r) => !targetSet.has(r));
  const roll = rng();

  if (spreadable.length > 0 && roll < 0.35) {
    const picked = spreadable[Math.floor(rng() * spreadable.length)];
    return {
      kind: 'spread',
      rule: picked,
      updatedRegionRules: [...targetRegionRules, picked],
      message: `The "${SPECIAL_RULE_INFO[picked].label}" rule has spread to this region!`,
    };
  }

  if (targetRegionRules.length > 0 && roll >= 0.35 && roll < 0.6) {
    const abolished = targetRegionRules[Math.floor(rng() * targetRegionRules.length)];
    return {
      kind: 'abolish',
      rule: abolished,
      updatedRegionRules: targetRegionRules.filter((r) => r !== abolished),
      message: `The "${SPECIAL_RULE_INFO[abolished].label}" rule has been abolished from this region!`,
    };
  }

  return {
    kind: 'none',
    rule: null,
    updatedRegionRules: [...targetRegionRules],
    message: 'Regional rules remained unchanged.',
  };
}

export function applyStudentRuleReset(
  regions: Record<RegionId, RegionState>,
): Record<RegionId, RegionState> {
  return {
    ...regions,
    balamb: {
      ...regions.balamb,
      specialRules: [],
    },
  };
}

export interface QueenInfluenceResult {
  regionTradeRule: TradeRule;
  queenTradeRule: TradeRule;
  queenMovedToRegionId: RegionId | null;
  announcements: string[];
}

/**
 * Faithful PS1 Queen of Cards trade-rule probabilities:
 * - If Queen is in the challenged region: 90/256 (~35.16%) region adopts Queen's personal trade rule.
 * - If challenging the Queen directly: 220/256 (~85.94%) her personal trade rule steps ±1 rank.
 * - After a match with the Queen, she may relocate to another region.
 */
export function applyQueenTradeInfluence(params: {
  challengedRegionId: RegionId;
  regionTradeRule: TradeRule;
  queenRegionId: RegionId;
  queenTradeRule: TradeRule;
  isQueenMatch: boolean;
  relocateQueen?: boolean;
  rng?: () => number;
}): QueenInfluenceResult {
  const rng = params.rng ?? Math.random;
  const announcements: string[] = [];
  let nextRegionTrade = params.regionTradeRule;
  let nextQueenTrade = params.queenTradeRule;
  let nextQueenRegion: RegionId | null = null;

  if (params.challengedRegionId === params.queenRegionId) {
    if (rng() < 90 / 256 && nextRegionTrade !== nextQueenTrade) {
      nextRegionTrade = nextQueenTrade;
      announcements.push(
        `Queen's influence shifted ${REGIONS[params.challengedRegionId].name}'s Trade Rule to ${TRADE_RULE_INFO[nextRegionTrade].label}.`,
      );
    }
  }

  if (params.isQueenMatch) {
    if (rng() < 220 / 256) {
      const idx = TRADE_RULE_LADDER.indexOf(nextQueenTrade);
      const step = idx === 0 ? 1 : idx === TRADE_RULE_LADDER.length - 1 ? -1 : rng() < 0.5 ? 1 : -1;
      nextQueenTrade = TRADE_RULE_LADDER[idx + step];
    }

    if (params.relocateQueen) {
      const candidates = REGION_ORDER.filter((r) => r !== params.queenRegionId);
      nextQueenRegion = candidates[Math.floor(rng() * candidates.length)];
      announcements.push(
        `The Queen of Cards departed for ${REGIONS[nextQueenRegion].name}.`,
      );
    }
  }

  return {
    regionTradeRule: nextRegionTrade,
    queenTradeRule: nextQueenTrade,
    queenMovedToRegionId: nextQueenRegion,
    announcements,
  };
}

export interface DominanceUpdateResult {
  regions: Record<RegionId, RegionState>;
  dominanceRegionId: RegionId;
  dominanceLevel: number;
  degenerationCounter: number;
  announcements: string[];
}

/**
 * Faithful PS1 Trade Dominance & Degeneration mechanics:
 * - Challenging in the dominant region increments dominance (up to 10); elsewhere decrements (down to 0; if already 0, switches dominance).
 * - Spread chance = (25 * dominanceLevel) / 256 to spread dominant region's trade rule to a random region.
 * - Degeneration counter rises by 0..7/256 per match; when triggered on spread, reverts a random region to 'one' and resets above 250/256.
 */
export function applyDominanceAndDegeneration(params: {
  regions: Record<RegionId, RegionState>;
  challengedRegionId: RegionId;
  dominanceRegionId: RegionId;
  dominanceLevel: number;
  degenerationCounter: number;
  rng?: () => number;
}): DominanceUpdateResult {
  const rng = params.rng ?? Math.random;
  const announcements: string[] = [];
  const nextRegions: Record<RegionId, RegionState> = { ...params.regions };

  let domRegion = params.dominanceRegionId;
  let domLevel = params.dominanceLevel;

  if (params.challengedRegionId === domRegion) {
    domLevel = Math.min(10, domLevel + 1);
  } else if (domLevel > 0) {
    domLevel -= 1;
  } else {
    domRegion = params.challengedRegionId;
    domLevel = 0;
  }

  let degen = params.degenerationCounter + Math.floor(rng() * 8);
  const spreadProb = (25 * domLevel) / 256;

  if (rng() < spreadProb) {
    const targetRegion = REGION_ORDER[Math.floor(rng() * REGION_ORDER.length)];
    const dominantRule = nextRegions[domRegion].tradeRule;
    if (nextRegions[targetRegion].tradeRule !== dominantRule) {
      nextRegions[targetRegion] = {
        ...nextRegions[targetRegion],
        tradeRule: dominantRule,
      };
      announcements.push(
        `Trade rule "${TRADE_RULE_INFO[dominantRule].label}" spread from ${REGIONS[domRegion].name} to ${REGIONS[targetRegion].name}.`,
      );
    }

    if (rng() < degen / 256) {
      const resetRegion = REGION_ORDER[Math.floor(rng() * REGION_ORDER.length)];
      if (nextRegions[resetRegion].tradeRule !== 'one') {
        nextRegions[resetRegion] = {
          ...nextRegions[resetRegion],
          tradeRule: 'one',
        };
        announcements.push(
          `${REGIONS[resetRegion].name}'s Trade Rule degenerated back to One.`,
        );
      }
    }
  }

  if (degen > 250) {
    degen = 0;
  }

  return {
    regions: nextRegions,
    dominanceRegionId: domRegion,
    dominanceLevel: domLevel,
    degenerationCounter: degen,
    announcements,
  };
}
