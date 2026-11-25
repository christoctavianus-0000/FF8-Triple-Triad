import { describe, expect, it } from 'vitest';
import { chooseAiMove } from '../ai';
import { applyMove, createAiPerceivedState, createMatch } from '../engine';
import type { AiTier, SpecialRule } from '../../types/tripleTriad';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function playHeadlessMatch(
  playerTier: AiTier,
  opponentTier: AiTier,
  rules: SpecialRule[],
  seed: number,
): 'player' | 'opponent' | 'draw' {
  const rng = makeSeededRng(seed);
  const pHand = ['ifrit', 'shiva', 'siren', 'diablos', 'carbuncle'];
  const oHand = ['ifrit', 'shiva', 'siren', 'diablos', 'carbuncle'];
  let state = createMatch({
    playerHand: pHand,
    opponentHand: oHand,
    rules,
    tradeRule: 'one',
    firstTurn: seed % 2 === 0 ? 'player' : 'opponent',
    rng,
  });

  while (state.phase === 'playing') {
    if (state.currentTurn === 'opponent') {
      const perceived = createAiPerceivedState(state);
      const move = chooseAiMove(perceived, opponentTier, rng);
      state = applyMove(state, move);
    } else {
      // Mirror opponent logic by flipping perspective onto PerceivedMatchState
      const mirrored = {
        ...state,
        board: state.board.map((c) => ({
          ...c,
          placed: c.placed
            ? {
                ...c.placed,
                owner: c.placed.owner === 'player' ? ('opponent' as const) : ('player' as const),
              }
            : null,
        })),
        playerHand: state.opponentHand,
        opponentHand: state.playerHand,
        currentTurn: 'opponent' as const,
      };
      const perceived = createAiPerceivedState(mirrored);
      const move = chooseAiMove(perceived, playerTier, rng);
      state = applyMove(state, {
        actor: 'player',
        handIndex: move.handIndex,
        cellIndex: move.cellIndex,
      });
    }
  }

  return state.winner ?? 'draw';
}

describe('Triple Triad AI & Information Hiding', () => {
  it('strips player hand from PerceivedMatchState when Open is inactive', () => {
    const match = createMatch({
      playerHand: ['squall', 'rinoa', 'zell', 'quistis', 'selphie'],
      opponentHand: ['geezard', 'funguar', 'bite-bug', 'red-bat', 'blobra'],
      rules: ['plus', 'elemental'],
      tradeRule: 'one',
    });
    const closed = createAiPerceivedState(match);
    expect(closed.visiblePlayerHand).toBeNull();
    expect(closed.playerHandCount).toBe(5);

    const openMatch = createMatch({
      playerHand: ['squall', 'rinoa', 'zell', 'quistis', 'selphie'],
      opponentHand: ['geezard', 'funguar', 'bite-bug', 'red-bat', 'blobra'],
      rules: ['open'],
      tradeRule: 'one',
    });
    const open = createAiPerceivedState(openMatch);
    expect(open.visiblePlayerHand).toEqual(['squall', 'rinoa', 'zell', 'quistis', 'selphie']);
  });

  it('completes 30 seeded matches with zero illegal moves and Master beats Novice decisively', () => {
    let masterWins = 0;
    let noviceWins = 0;
    for (let i = 1; i <= 30; i += 1) {
      const result = playHeadlessMatch('novice', 'master', ['open', 'same', 'plus'], i * 37);
      if (result === 'opponent') masterWins += 1;
      else if (result === 'player') noviceWins += 1;
    }
    expect(masterWins).toBeGreaterThan(noviceWins);
    expect(masterWins).toBeGreaterThanOrEqual(20);
  });
});
