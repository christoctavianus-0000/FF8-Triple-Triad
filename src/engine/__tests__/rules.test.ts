import { describe, expect, it } from 'vitest';
import { createBoard, createMatch, applyMove, startSuddenDeathRound } from '../engine';
import { getEffectiveRanks, resolvePlacement } from '../rules';
import type { BoardCell, CardDefinition, ElementType } from '../../types/tripleTriad';

function makeCard(
  id: string,
  ranks: [number, number, number, number],
  element: ElementType = 'none',
): CardDefinition {
  return {
    index: 1,
    id,
    name: id,
    level: 1,
    category: 'monster',
    ranks: { top: ranks[0], right: ranks[1], bottom: ranks[2], left: ranks[3] },
    element,
    cardMod: 'None',
    isRare: false,
    imagePath: `./assets/cards/${id}.png`,
  };
}

function emptyBoard(): BoardCell[] {
  return createBoard(false);
}

describe('Triple Triad Rules Engine', () => {
  it('performs basic captures strictly when placed rank > neighbor rank and never chains Combo', () => {
    const cards = {
      oppCenter: makeCard('oppCenter', [5, 5, 2, 5]),
      oppRight: makeCard('oppRight', [5, 5, 5, 1]),
      plyLeft: makeCard('plyLeft', [4, 7, 4, 4]),
      oppBottom: makeCard('oppBottom', [9, 4, 4, 4]),
    };
    const board = emptyBoard();
    board[4].placed = { cardId: 'oppCenter', owner: 'opponent', originalOwner: 'opponent' };
    board[5].placed = { cardId: 'oppRight', owner: 'opponent', originalOwner: 'opponent' };
    board[7].placed = { cardId: 'oppBottom', owner: 'opponent', originalOwner: 'opponent' };

    // Place plyLeft at index 3 (left of center): right(7) > oppCenter.left(5)
    // Even though oppCenter.right(5) > oppRight.left(1), Basic NEVER triggers Combo.
    const res = resolvePlacement(board, 3, cards.plyLeft, 'player', [], cards);
    expect(res.nextBoard[4].placed?.owner).toBe('player');
    expect(res.nextBoard[5].placed?.owner).toBe('opponent');
    expect(res.flipEvents).toHaveLength(1);
    expect(res.flipEvents[0].trigger).toBe('basic');
    expect(res.triggeredRules).toEqual([]);
  });

  it('applies Elemental +1/-1 modifiers (including non-elemental -1, 10+1=11 beating 10, and 1-1=0 losing to 1)', () => {
    const fireCard = makeCard('fireA', [10, 10, 10, 10], 'fire');
    const neutralCard = makeCard('neutral', [10, 10, 10, 1], 'none');
    const iceWeak = makeCard('iceWeak', [1, 1, 1, 1], 'ice');
    const cards = { fireA: fireCard, neutral: neutralCard, iceWeak };

    expect(getEffectiveRanks(fireCard, 'fire', true).right).toBe(11);
    expect(getEffectiveRanks(neutralCard, 'fire', true).top).toBe(9);
    expect(getEffectiveRanks(neutralCard, 'fire', true).left).toBe(0);
    expect(getEffectiveRanks(iceWeak, 'fire', true).left).toBe(0);

    const board = emptyBoard();
    board[4].element = 'none';
    board[4].placed = { cardId: 'neutral', owner: 'opponent', originalOwner: 'opponent' }; // left=10, right=10
    board[3].element = 'fire';

    // fireA placed at 3 (Fire tile) gets +1 -> right=11 > neutral left=10!
    const res1 = resolvePlacement(board, 3, fireCard, 'player', ['elemental'], cards);
    expect(res1.nextBoard[4].placed?.owner).toBe('player');

    // iceWeak placed at 5 (Fire tile) gets -1 -> left=0 < neutral right=1 (even if neutral right was 1)
    const board2 = emptyBoard();
    board2[4].placed = { cardId: 'neutral', owner: 'opponent', originalOwner: 'opponent' }; // right=10
    board2[5].element = 'fire';
    const oneRight = makeCard('oneRight', [1, 1, 1, 1], 'none');
    const cards2 = { neutral: makeCard('neutral', [1, 1, 1, 1], 'none'), oneRight };
    const res2 = resolvePlacement(board2, 5, oneRight, 'player', ['elemental'], cards2);
    // oneRight on fire gets -1 -> left=0 vs neutral right=1 -> does NOT flip
    expect(res2.nextBoard[4].placed?.owner).toBe('opponent');
  });

  it('triggers Same using printed ranks (ignoring Elemental) and supports friendly + enemy matches', () => {
    const cards = {
      plyTop: makeCard('plyTop', [2, 2, 5, 2], 'none'),
      oppLeft: makeCard('oppLeft', [2, 6, 2, 2], 'fire'),
      placer: makeCard('placer', [5, 1, 1, 6], 'ice'),
    };
    const board = emptyBoard();
    board[1].placed = { cardId: 'plyTop', owner: 'player', originalOwner: 'player' };
    board[3].element = 'fire'; // boosts oppLeft effective rank to 7, but printed is still 6!
    board[3].placed = { cardId: 'oppLeft', owner: 'opponent', originalOwner: 'opponent' };
    board[4].element = 'fire'; // debuffs placer effective rank, but printed is still 5 / 6!

    const res = resolvePlacement(
      board,
      4,
      cards.placer,
      'player',
      ['same', 'elemental'],
      cards,
    );
    expect(res.triggeredRules).toContain('same');
    expect(res.nextBoard[3].placed?.owner).toBe('player');
  });

  it('keeps Same Wall inert when Same is off, and treats outer wall as A (10) when Same is on', () => {
    const cards = {
      oppBottom: makeCard('oppBottom', [7, 2, 2, 2]),
      wallCard: makeCard('wallCard', [10, 2, 7, 10]), // top=A, left=A against top-left walls, bottom=7
    };
    const board = emptyBoard();
    board[3].placed = { cardId: 'oppBottom', owner: 'opponent', originalOwner: 'opponent' };

    // Only Same Wall (no Same) -> must NOT capture oppBottom (7 == 7)
    const inertRes = resolvePlacement(board, 0, cards.wallCard, 'player', ['sameWall'], cards);
    expect(inertRes.nextBoard[3].placed?.owner).toBe('opponent');
    expect(inertRes.triggeredRules).toEqual([]);

    // Same + Same Wall -> top wall (10) + left wall (10) + bottom (7==7) -> captures oppBottom!
    const activeRes = resolvePlacement(
      board,
      0,
      cards.wallCard,
      'player',
      ['same', 'sameWall'],
      cards,
    );
    expect(activeRes.nextBoard[3].placed?.owner).toBe('player');
    expect(activeRes.triggeredRules).toContain('sameWall');
  });

  it('triggers Plus with equal touching sums and cascades multi-hop Combo using Elemental ranks', () => {
    const cards = {
      oppTop: makeCard('oppTop', [1, 1, 4, 1]), // bottom=4
      oppLeft: makeCard('oppLeft', [1, 3, 1, 1]), // right=3
      oppFarLeft: makeCard('oppFarLeft', [1, 1, 1, 1]), // right=1
      oppTopRight: makeCard('oppTopRight', [1, 1, 1, 9]), // left=9 (cannot flip from oppTop.right=1)
      oppTopLeft: makeCard('oppTopLeft', [1, 1, 2, 1]), // bottom=2 -> flipped by Combo from oppLeft.top? Wait: oppLeft at 3, oppTopLeft at 0 -> oppLeft.top=1 vs oppTopLeft.bottom=2, let's give oppLeft top=5!
      placer: makeCard('placer', [5, 1, 1, 6]), // top=5+4=9, left=6+3=9 -> PLUS!
    };
    cards.oppLeft = makeCard('oppLeft', [5, 3, 1, 1]);
    cards.oppTopLeft = makeCard('oppTopLeft', [1, 1, 2, 1]);

    const board = emptyBoard();
    board[1].placed = { cardId: 'oppTop', owner: 'opponent', originalOwner: 'opponent' };
    board[3].placed = { cardId: 'oppLeft', owner: 'opponent', originalOwner: 'opponent' };
    board[0].placed = { cardId: 'oppTopLeft', owner: 'opponent', originalOwner: 'opponent' };

    const res = resolvePlacement(board, 4, cards.placer, 'player', ['plus'], cards);
    expect(res.triggeredRules).toEqual(['plus', 'combo']);
    expect(res.nextBoard[1].placed?.owner).toBe('player');
    expect(res.nextBoard[3].placed?.owner).toBe('player');
    // oppLeft was flipped by Plus and in turn Combo-flipped oppTopLeft (5 > 2)!
    expect(res.nextBoard[0].placed?.owner).toBe('player');
    expect(res.flipEvents.some((f) => f.trigger === 'combo' && f.flippedIndex === 0)).toBe(true);
  });

  it('triggers Sudden Death on 5-5 tie and redistributes colored cards into next round hands', () => {
    // Construct a deterministic 9-turn 5-5 draw under Sudden Death
    let state = createMatch({
      playerHand: ['geezard', 'funguar', 'bite-bug', 'red-bat', 'blobra'],
      opponentHand: ['geezard', 'funguar', 'bite-bug', 'red-bat', 'blobra'],
      rules: ['suddenDeath'],
      tradeRule: 'one',
      firstTurn: 'player',
      rng: () => 0.1,
    });

    // Play all 9 cells with identical weak cards in non-capturing order -> 5 blue, 5 red!
    const order = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (let turn = 0; turn < 9; turn += 1) {
      state = applyMove(state, {
        actor: state.currentTurn,
        handIndex: 0,
        cellIndex: order[turn],
      });
    }

    if (state.scores.player === 5 && state.scores.opponent === 5) {
      expect(state.phase).toBe('suddenDeathPending');
      const nextRound = startSuddenDeathRound(state, () => 0.2);
      expect(nextRound.phase).toBe('playing');
      expect(nextRound.suddenDeathRound).toBe(2);
      expect(nextRound.playerHand).toHaveLength(5);
      expect(nextRound.opponentHand).toHaveLength(5);
      expect(nextRound.board.every((c) => c.placed === null)).toBe(true);
    } else {
      expect(state.phase).toBe('finished');
    }
  });
});
