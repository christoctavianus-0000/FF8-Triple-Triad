import { describe, expect, it } from 'vitest';
import { resolveTrade } from '../engine';
import {
  applyQueenTradeInfluence,
  applyStudentRuleReset,
  canOfferRuleMix,
  getVisibleRules,
  isRuleVisibleInPreview,
  resolveRuleMixOutcome,
} from '../regionalRules';
import { createInitialRegions } from '../../state/profileStore';
import type { TradePhaseSummary } from '../../types/tripleTriad';

describe('Trade Rules & Regional Rule Spread/Abolish', () => {
  const baseSummary: Omit<TradePhaseSummary, 'tradeRule' | 'cardsToPick' | 'picker'> = {
    winner: 'player',
    playerPoolIds: ['geezard', 'funguar', 'bite-bug', 'red-bat', 'blobra'],
    opponentPoolIds: ['ifrit', 'cactuar', 'tonberry', 'ruby-dragon', 'behemoth'],
    directGainedByPlayer: ['ifrit', 'cactuar'],
    directLostByPlayer: ['geezard'],
  };

  it('resolves One, Diff, Direct, and All trade rules accurately', () => {
    const oneRes = resolveTrade(
      { ...baseSummary, tradeRule: 'one', cardsToPick: 1, picker: 'player' },
      ['ifrit'],
    );
    expect(oneRes.gainedByPlayer).toEqual(['ifrit']);
    expect(oneRes.lostByPlayer).toEqual([]);

    const diffRes = resolveTrade(
      { ...baseSummary, tradeRule: 'diff', cardsToPick: 3, picker: 'player' },
      ['ifrit', 'ruby-dragon', 'behemoth'],
    );
    expect(diffRes.gainedByPlayer).toEqual(['ifrit', 'ruby-dragon', 'behemoth']);

    const allRes = resolveTrade(
      { ...baseSummary, tradeRule: 'all', cardsToPick: 5, picker: 'player' },
      [],
    );
    expect(allRes.gainedByPlayer).toHaveLength(5);

    const directRes = resolveTrade(
      { ...baseSummary, winner: 'draw', tradeRule: 'direct', cardsToPick: 0, picker: null },
      [],
    );
    expect(directRes.gainedByPlayer).toEqual(['ifrit', 'cactuar']);
    expect(directRes.lostByPlayer).toEqual(['geezard']);
  });

  it('hides Same Wall in previews unless Same is also active', () => {
    expect(isRuleVisibleInPreview('sameWall', ['elemental', 'sameWall'])).toBe(false);
    expect(getVisibleRules(['elemental', 'sameWall'])).toEqual(['elemental']);
    expect(isRuleVisibleInPreview('sameWall', ['same', 'sameWall'])).toBe(true);
    expect(getVisibleRules(['same', 'sameWall'])).toEqual(['same', 'sameWall']);
  });

  it('detects Mixed Rules offer and handles spread/abolish/no-change deterministically', () => {
    expect(canOfferRuleMix(['open'], ['same'])).toBe(true);
    expect(canOfferRuleMix(['same'], ['same', 'plus'])).toBe(false);

    const spread = resolveRuleMixOutcome(['open'], ['same'], () => 0.1);
    expect(spread.kind).toBe('spread');
    expect(spread.updatedRegionRules).toEqual(['same', 'open']);

    const abolish = resolveRuleMixOutcome(['open'], ['same', 'plus'], () => 0.45);
    expect(abolish.kind).toBe('abolish');
    expect(abolish.updatedRegionRules).toHaveLength(1);

    const none = resolveRuleMixOutcome(['open'], ['same'], () => 0.85);
    expect(none.kind).toBe('none');
    expect(none.updatedRegionRules).toEqual(['same']);
  });

  it('wipes all Balamb special rules when challenging Student Skipping Class', () => {
    const regions = createInitialRegions();
    regions.balamb.specialRules = ['open', 'same', 'plus'];
    const wiped = applyStudentRuleReset(regions);
    expect(wiped.balamb.specialRules).toEqual([]);
    expect(wiped.galbadia.specialRules).toEqual(['same']);
  });

  it('applies Queen of Cards trade rule adoption and personal step shift', () => {
    const res = applyQueenTradeInfluence({
      challengedRegionId: 'dollet',
      regionTradeRule: 'one',
      queenRegionId: 'dollet',
      queenTradeRule: 'all',
      isQueenMatch: true,
      relocateQueen: true,
      rng: () => 0.1,
    });
    expect(res.regionTradeRule).toBe('all');
    expect(res.queenTradeRule).toBe('direct');
    expect(res.queenMovedToRegionId).not.toBe('dollet');
  });
});
