import { describe, expect, it } from 'vitest';
import {
  applyTradeToProfile,
  createDefaultProfile,
  getActiveDeck,
  getTotalCardCount,
  sanitizeProfile,
  setActiveDeckInProfile,
  STARTER_CARD_IDS,
  updateDeckInProfile,
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

  it('sanitizes corrupted save payloads cleanly and migrates legacy saves missing decks', () => {
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
    expect(sanitized.decks).toHaveLength(5);
    expect(sanitized.activeDeckId).toBe('deck_1');
    expect(sanitized.decks[0].cards).toHaveLength(5);
  });

  it('supports updating, activating, and repairing saved decks after losing a card', () => {
    let profile = createDefaultProfile();
    profile.collection.ifrit = 1;
    profile.rareCardHolders.ifrit = 'player';

    profile = updateDeckInProfile(profile, 'deck_2', 'Fire Squad', [
      'ifrit',
      'geezard',
      'funguar',
      'bite-bug',
      'red-bat',
    ]);
    profile = setActiveDeckInProfile(profile, 'deck_2');
    expect(getActiveDeck(profile).name).toBe('Fire Squad');
    expect(profile.lastDeckIds[0]).toBe('ifrit');

    // Losing Ifrit should automatically repair deck_2 so Ifrit is no longer equipped
    const outcome = applyTradeToProfile(
      profile,
      { gainedByPlayer: [], lostByPlayer: ['ifrit'], protectedCardIds: [] },
      'balamb-gatekeeper',
      false,
    );
    const repairedDeck2 = outcome.profile.decks.find((d) => d.id === 'deck_2')!;
    expect(repairedDeck2.cards).toHaveLength(5);
    expect(repairedDeck2.cards).not.toContain('ifrit');
  });
});
