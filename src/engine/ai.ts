import { CARDS_BY_ID } from '../data/cards';
import type {
  AiTier,
  BoardCell,
  CardDefinition,
  MoveAction,
  Owner,
  PerceivedMatchState,
  SpecialRule,
} from '../types/tripleTriad';
import { getEffectiveRanks, resolvePlacement } from './rules';

const ADJACENT_INDEX_OFFSETS: readonly {
  side: 'top' | 'right' | 'bottom' | 'left';
  opposite: 'top' | 'right' | 'bottom' | 'left';
  dRow: number;
  dCol: number;
}[] = [
  { side: 'top', opposite: 'bottom', dRow: -1, dCol: 0 },
  { side: 'right', opposite: 'left', dRow: 0, dCol: 1 },
  { side: 'bottom', opposite: 'top', dRow: 1, dCol: 0 },
  { side: 'left', opposite: 'right', dRow: 0, dCol: -1 },
];

function evaluateBoardHeuristic(
  board: readonly BoardCell[],
  rules: readonly SpecialRule[],
  perspective: Owner,
  cardsById: Readonly<Record<string, CardDefinition>>,
): number {
  const elementalActive = rules.includes('elemental');
  let score = 0;

  for (let i = 0; i < 9; i += 1) {
    const cell = board[i];
    if (!cell.placed) continue;
    const ownerSign = cell.placed.owner === perspective ? 1 : -1;
    score += ownerSign * 100;

    const card = cardsById[cell.placed.cardId];
    const eff = getEffectiveRanks(card, cell.element, elementalActive);
    const row = Math.floor(i / 3);
    const col = i % 3;

    // Evaluate exposed sides adjacent to empty squares
    for (const dir of ADJACENT_INDEX_OFFSETS) {
      const r = row + dir.dRow;
      const c = col + dir.dCol;
      if (r < 0 || r >= 3 || c < 0 || c >= 3) {
        // Protected against board wall
        score += ownerSign * 4;
        continue;
      }
      const nIdx = r * 3 + c;
      if (board[nIdx].placed === null) {
        // Higher exposed rank is safer; low exposed rank (<5) is vulnerable
        const rank = eff[dir.side];
        score += ownerSign * (rank - 5.5) * 3.2;
      }
    }
  }

  return score;
}

function listCandidateMoves(
  board: readonly BoardCell[],
  hand: readonly string[],
  actor: Owner,
): MoveAction[] {
  const emptyCells: number[] = [];
  for (let i = 0; i < 9; i += 1) {
    if (board[i].placed === null) emptyCells.push(i);
  }
  const seenCardIds = new Set<string>();
  const moves: MoveAction[] = [];

  for (let hi = 0; hi < hand.length; hi += 1) {
    const cid = hand[hi];
    if (seenCardIds.has(cid)) continue;
    seenCardIds.add(cid);
    for (const cellIndex of emptyCells) {
      moves.push({ actor, handIndex: hi, cellIndex });
    }
  }
  return moves;
}

function scoreOnePlyMove(
  state: PerceivedMatchState,
  move: MoveAction,
  cardsById: Readonly<Record<string, CardDefinition>>,
): number {
  const card = cardsById[state.opponentHand[move.handIndex]];
  const res = resolvePlacement(
    state.board,
    move.cellIndex,
    card,
    'opponent',
    state.rules,
    cardsById,
  );
  let value = evaluateBoardHeuristic(res.nextBoard, state.rules, 'opponent', cardsById);
  value += res.flipEvents.length * 18;
  if (res.triggeredRules.includes('combo')) value += 22;
  if (res.triggeredRules.includes('same') || res.triggeredRules.includes('plus')) value += 12;
  // Slightly prefer saving highest-rank cards unless they net captures
  const rankSum = card.ranks.top + card.ranks.right + card.ranks.bottom + card.ranks.left;
  value -= rankSum * 0.15;
  return value;
}

function minimaxOpen(
  board: readonly BoardCell[],
  opponentHand: readonly string[],
  playerHand: readonly string[],
  turn: Owner,
  depth: number,
  alpha: number,
  beta: number,
  rules: readonly SpecialRule[],
  cardsById: Readonly<Record<string, CardDefinition>>,
): number {
  const boardFull = board.every((c) => c.placed !== null);
  if (boardFull || depth === 0) {
    if (boardFull) {
      let opp = opponentHand.length;
      let ply = playerHand.length;
      for (const c of board) {
        if (!c.placed) continue;
        if (c.placed.owner === 'opponent') opp += 1;
        else ply += 1;
      }
      return (opp - ply) * 500;
    }
    return evaluateBoardHeuristic(board, rules, 'opponent', cardsById);
  }

  if (turn === 'opponent') {
    let best = -Infinity;
    const moves = listCandidateMoves(board, opponentHand, 'opponent');
    for (const m of moves) {
      const card = cardsById[opponentHand[m.handIndex]];
      const { nextBoard } = resolvePlacement(board, m.cellIndex, card, 'opponent', rules, cardsById);
      const nextOpp = opponentHand.filter((_, i) => i !== m.handIndex);
      const val = minimaxOpen(
        nextBoard,
        nextOpp,
        playerHand,
        'player',
        depth - 1,
        alpha,
        beta,
        rules,
        cardsById,
      );
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  const moves = listCandidateMoves(board, playerHand, 'player');
  for (const m of moves) {
    const card = cardsById[playerHand[m.handIndex]];
    const { nextBoard } = resolvePlacement(board, m.cellIndex, card, 'player', rules, cardsById);
    const nextPly = playerHand.filter((_, i) => i !== m.handIndex);
    const val = minimaxOpen(
      nextBoard,
      opponentHand,
      nextPly,
      'opponent',
      depth - 1,
      alpha,
      beta,
      rules,
      cardsById,
    );
    if (val < best) best = val;
    if (best < beta) beta = best;
    if (beta <= alpha) break;
  }
  return best;
}

/**
 * Selects the AI's next move strictly from PerceivedMatchState (information-safe).
 * Never inspects hidden player hand cards when Open is inactive.
 */
export function chooseAiMove(
  perceivedState: PerceivedMatchState,
  tier: AiTier,
  rng: () => number = Math.random,
  cardsById: Readonly<Record<string, CardDefinition>> = CARDS_BY_ID,
): MoveAction {
  if (perceivedState.currentTurn !== 'opponent') {
    throw new Error('chooseAiMove called when it is not opponent turn');
  }
  const moves = listCandidateMoves(
    perceivedState.board,
    perceivedState.opponentHand,
    'opponent',
  );
  if (moves.length === 0) {
    throw new Error('No legal moves available for AI');
  }

  if (tier === 'novice') {
    // 55% pure random, 45% noisy 1-ply
    if (rng() < 0.55) {
      return moves[Math.floor(rng() * moves.length)];
    }
    let bestMove = moves[0];
    let bestScore = -Infinity;
    for (const move of moves) {
      const card = cardsById[perceivedState.opponentHand[move.handIndex]];
      const res = resolvePlacement(
        perceivedState.board,
        move.cellIndex,
        card,
        'opponent',
        perceivedState.rules,
        cardsById,
      );
      const score = res.flipEvents.length * 20 + (rng() - 0.5) * 35;
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    return bestMove;
  }

  if (tier === 'standard') {
    let bestMoves: MoveAction[] = [];
    let bestScore = -Infinity;
    for (const move of moves) {
      const score = scoreOnePlyMove(perceivedState, move, cardsById);
      if (score > bestScore + 1e-6) {
        bestScore = score;
        bestMoves = [move];
      } else if (Math.abs(score - bestScore) <= 1e-6) {
        bestMoves.push(move);
      }
    }
    return bestMoves[Math.floor(rng() * bestMoves.length)];
  }

  // Master tier:
  // - If Open is ON, run 2-ply (or 3-ply late-game) alpha-beta against visible player hand.
  // - If Open is OFF, score 1-ply + exposed-flank threat penalty without peeking at player's hand!
  const openHand = perceivedState.visiblePlayerHand;
  if (openHand !== null && openHand.length > 0) {
    const emptyCount = perceivedState.board.filter((c) => c.placed === null).length;
    const depth = emptyCount <= 5 ? 3 : 2;
    let bestMoves: MoveAction[] = [];
    let bestVal = -Infinity;

    // Order moves by 1-ply score to improve alpha-beta pruning
    const ordered = [...moves].sort(
      (a, b) =>
        scoreOnePlyMove(perceivedState, b, cardsById) -
        scoreOnePlyMove(perceivedState, a, cardsById),
    );

    for (const move of ordered) {
      const card = cardsById[perceivedState.opponentHand[move.handIndex]];
      const { nextBoard } = resolvePlacement(
        perceivedState.board,
        move.cellIndex,
        card,
        'opponent',
        perceivedState.rules,
        cardsById,
      );
      const nextOpp = perceivedState.opponentHand.filter((_, i) => i !== move.handIndex);
      const val =
        minimaxOpen(
          nextBoard,
          nextOpp,
          openHand,
          'player',
          depth - 1,
          -Infinity,
          Infinity,
          perceivedState.rules,
          cardsById,
        ) +
        scoreOnePlyMove(perceivedState, move, cardsById) * 0.05;

      if (val > bestVal + 1e-6) {
        bestVal = val;
        bestMoves = [move];
      } else if (Math.abs(val - bestVal) <= 1e-6) {
        bestMoves.push(move);
      }
    }
    return bestMoves[Math.floor(rng() * bestMoves.length)];
  }

  // Hidden-hand Master: 1-ply plus stronger Same/Plus/Exposed-Rank defense
  let bestMoves: MoveAction[] = [];
  let bestScore = -Infinity;
  for (const move of moves) {
    const card = cardsById[perceivedState.opponentHand[move.handIndex]];
    const res = resolvePlacement(
      perceivedState.board,
      move.cellIndex,
      card,
      'opponent',
      perceivedState.rules,
      cardsById,
    );
    let score = evaluateBoardHeuristic(res.nextBoard, perceivedState.rules, 'opponent', cardsById);
    score += res.flipEvents.length * 26;
    if (res.triggeredRules.includes('combo')) score += 28;
    if (res.triggeredRules.includes('same') || res.triggeredRules.includes('plus')) score += 16;

    // Bonus for anchoring corners when empty
    const isCorner = move.cellIndex === 0 || move.cellIndex === 2 || move.cellIndex === 6 || move.cellIndex === 8;
    if (isCorner) score += 8;

    if (score > bestScore + 1e-6) {
      bestScore = score;
      bestMoves = [move];
    } else if (Math.abs(score - bestScore) <= 1e-6) {
      bestMoves.push(move);
    }
  }
  return bestMoves[Math.floor(rng() * bestMoves.length)];
}

export function chooseAiTradeCards(
  loserHandIds: readonly string[],
  count: number,
  cardsById: Readonly<Record<string, CardDefinition>> = CARDS_BY_ID,
): string[] {
  if (count <= 0) return [];
  const indexed = loserHandIds.map((id, idx) => {
    const c = cardsById[id];
    const rankTotal = c ? c.ranks.top + c.ranks.right + c.ranks.bottom + c.ranks.left : 0;
    const score = (c?.isRare ? 1000 : 0) + (c?.level ?? 0) * 40 + rankTotal;
    return { id, idx, score };
  });
  indexed.sort((a, b) => b.score - a.score);
  return indexed.slice(0, Math.min(count, indexed.length)).map((item) => item.id);
}
