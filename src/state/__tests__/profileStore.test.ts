import { describe, expect, it } from 'vitest';
import {
  applyTradeToProfile,
  createDefaultProfile,
  getTotalCardCount,
  sanitizeProfile,
  STARTER_CARD_IDS,
} from '../profileStore';

describe('ProfileStore, Softlock Protection & Queen Forge', () => {
  it('initializes with 7 starter cards and valid rare card holders', () => {
    const profile = createDefaultProfile();
    expect(getTotalCardCount(profile.collection)).toBe(7);
    for (const id of STARTER_CARD_IDS) {
      expect(profile.collection[id]).toBe(1);
    }
    expect(profile.rareCardHolders.squall).toBe('npc:laguna-loire');
    expect(profile.rareCardHolders.kiros).toBe('unforged');
  });

  it('protects the last 5 playable cards when losing under All/Diff trade rules', () => {
    const profile = createDefaultProfile(); // 7 cards total
    const outcome = applyTradeToProfile(
      profile,
      {
        gainedByPlayer: [],
        lostByPlayer: ['geezard', 'funguar', 'bite-bug', 'red-bat', 'blobra'],
        protectedCardIds: [],
      },
      'balamb-gatekeeper',
      false,
    );

    expect(getTotalCardCount(outcome.profile.collection)).toBe(5);
    expect(outcome.appliedTrade.lostByPlayer).toHaveLength(2);
    expect(outcome.appliedTrade.protectedCardIds).toHaveLength(3);
  });

  it('forges Kiros when MiniMog is lost to the Queen of Cards and skips mutation in Sandbox mode', () => {
    const profile = createDefaultProfile();
    profile.collection.minimog = 1;
    profile.rareCardHolders.minimog = 'player';

    // Sandbox skips collection mutation
    const sandboxOutcome = applyTradeToProfile(
      profile,
      { gainedByPlayer: ['squall'], lostByPlayer: ['minimog'], protectedCardIds: [] },
      'queen-of-cards',
      true,
    );
    expect(sandboxOutcome.profile.collection.squall).toBeUndefined();
    expect(sandboxOutcome.profile.collection.minimog).toBe(1);

    // Campaign mode loses MiniMog -> Queen holds MiniMog AND Kiros is forged!
    const campaignOutcome = applyTradeToProfile(
      profile,
      { gainedByPlayer: [], lostByPlayer: ['minimog'], protectedCardIds: [] },
      'queen-of-cards',
      false,
    );
    expect(campaignOutcome.profile.collection.minimog).toBeUndefined();
    expect(campaignOutcome.profile.rareCardHolders.minimog).toBe('npc:queen-of-cards');
    expect(campaignOutcome.profile.rareCardHolders.kiros).toBe('npc:deling-merchant');
    expect(campaignOutcome.profile.queenForgedCardIds).toContain('kiros');
    expect(campaignOutcome.queenForgeMessages).toHaveLength(1);
  });

  it('sanitizes corrupted save payloads cleanly', () => {
    const sanitized = sanitizeProfile({
      collection: { 'not-a-card': 99, squall: 5 },
      ccGroupStage: 999,
      queenRegionId: 'invalid-region',
    });
    expect(sanitized.collection['not-a-card']).toBeUndefined();
    expect(sanitized.collection.squall).toBe(1); // rare capped at 1
    expect(getTotalCardCount(sanitized.collection)).toBeGreaterThanOrEqual(5);
    expect(sanitized.ccGroupStage).toBe(7);
    expect(sanitized.queenRegionId).toBe('dollet');
  });
});
