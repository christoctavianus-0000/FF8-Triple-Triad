import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARDS_BY_ID } from '../cards';
import { NPCS, QUEEN_FORGED_CARD_IDS } from '../opponents';

const VALID_ELEMENTS = new Set([
  'none',
  'earth',
  'fire',
  'ice',
  'poison',
  'thunder',
  'water',
  'wind',
  'holy',
]);

describe('Triple Triad Canonical 110 Cards & Assets', () => {
  it('contains exactly 110 unique cards with 11 per level 1..10', () => {
    expect(ALL_CARDS).toHaveLength(110);
    const ids = new Set(ALL_CARDS.map((c) => c.id));
    expect(ids.size).toBe(110);

    for (let lvl = 1; lvl <= 10; lvl += 1) {
      const ofLevel = ALL_CARDS.filter((c) => c.level === lvl);
      expect(ofLevel).toHaveLength(11);
    }
  });

  it('has valid ranks (1..10), valid elements, and existing PNG assets on disk', () => {
    const publicDir = path.resolve(process.cwd(), 'public');
    for (const card of ALL_CARDS) {
      expect(CARDS_BY_ID[card.id]).toBeDefined();
      expect(VALID_ELEMENTS.has(card.element)).toBe(true);
      for (const r of [card.ranks.top, card.ranks.right, card.ranks.bottom, card.ranks.left]) {
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(10);
      }
      const imgFile = path.join(publicDir, card.imagePath.replace(/^\.\//, ''));
      expect(fs.existsSync(imgFile)).toBe(true);
    }

    for (const el of VALID_ELEMENTS) {
      if (el === 'none') continue;
      const elFile = path.join(publicDir, 'assets', 'elements', `${el}.png`);
      expect(fs.existsSync(elFile)).toBe(true);
    }
  });

  it('ensures every Level 8-10 rare card is assigned to an NPC or Queen quest', () => {
    const npcRareSet = new Set(NPCS.flatMap((n) => n.rareCardIds));
    const queenSet = new Set(QUEEN_FORGED_CARD_IDS);
    const rares = ALL_CARDS.filter((c) => c.isRare);
    expect(rares).toHaveLength(33);

    for (const rare of rares) {
      expect(npcRareSet.has(rare.id) || queenSet.has(rare.id)).toBe(true);
    }
  });
});
