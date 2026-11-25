import { CARDS_BY_ID } from '../data/cards';
import type {
  BoardCell,
  CardDefinition,
  ElementType,
  MatchState,
  MoveAction,
  NpcDefinition,
  Owner,
  PerceivedMatchState,
  SpecialRule,
  TradePhaseSummary,
  TradeResolution,
  TradeRule,
} from '../types/tripleTriad';
import { resolvePlacement } from './rules';

const ALL_ELEMENTS: readonly ElementType[] = [
  'earth',
  'fire',
  'ice',
  'poison',
  'thunder',
  'water',
  'wind',
  'holy',
];

export interface CreateMatchConfig {
  matchId?: string;
  playerHand: string[];
  opponentHand: string[];
  rules: SpecialRule[];
  tradeRule: TradeRule;
  firstTurn?: Owner;
  rng?: () => number;
}

export function createBoard(
  elementalActive: boolean,
  rng: () => number = Math.random,
): BoardCell[] {
  const cells: BoardCell[] = Array.from({ length: 9 }, (_, index) => ({
    index,
    element: 'none' as ElementType,
    placed: null,
  }));

  if (!elementalActive) return cells;

  let assigned = 0;
  for (let i = 0; i < 9; i += 1) {
    if (rng() < 0.25) {
      cells[i].element = ALL_ELEMENTS[Math.floor(rng() * ALL_ELEMENTS.length)];
      assigned += 1;
    }
  }
  if (assigned === 0) {
    const idx = Math.floor(rng() * 9);
    cells[idx].element = ALL_ELEMENTS[Math.floor(rng() * ALL_ELEMENTS.length)];
  }
  return cells;
}

export function computeScores(
  board: readonly BoardCell[],
  playerHandCount: number,
  opponentHandCount: number,
): { player: number; opponent: number } {
  let player = playerHandCount;
  let opponent = opponentHandCount;
  for (const cell of board) {
    if (!cell.placed) continue;
    if (cell.placed.owner === 'player') player += 1;
    else opponent += 1;
  }
  return { player, opponent };
}

export function buildRandomHand(
  collection: Readonly<Record<string, number>>,
  rng: () => number = Math.random,
): string[] {
  const pool: string[] = [];
  for (const [cardId, count] of Object.entries(collection)) {
    if (!CARDS_BY_ID[cardId]) continue;
    for (let i = 0; i < count; i += 1) {
      pool.push(cardId);
    }
  }
  if (pool.length < 5) {
    throw new Error(`Player needs at least 5 cards in collection (found ${pool.length})`);
  }
  // Fisher-Yates shuffle on copy
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 5);
}

export function buildNpcHand(
  npc: NpcDefinition,
  allCards: readonly CardDefinition[],
  rareCardHolders: Readonly<Record<string, string>>,
  rng: () => number = Math.random,
): string[] {
  const hand: string[] = [];
  const availableRares = npc.rareCardIds.filter(
    (cardId) => rareCardHolders[cardId] === `npc:${npc.id}`,
  );
  // 45% chance per rare card owned by NPC to appear in hand (at least 1 guaranteed if it's their signature bounty and rng < 0.75)
  for (const rareId of availableRares) {
    if (hand.length < 2 && rng() < 0.72) {
      hand.push(rareId);
    }
  }

  const levelSet = new Set(npc.deckLevels);
  const candidates = allCards.filter((c) => !c.isRare && levelSet.has(c.level));
  const fallback = allCards.filter((c) => !c.isRare && c.level <= 5);
  const pool = candidates.length > 0 ? candidates : fallback;

  while (hand.length < 5) {
    const pick = pool[Math.floor(rng() * pool.length)];
    hand.push(pick.id);
  }
  return hand;
}

export function createMatch(config: CreateMatchConfig): MatchState {
  const rng = config.rng ?? Math.random;
  if (config.playerHand.length !== 5 || config.opponentHand.length !== 5) {
    throw new Error('Both player and opponent hands must contain exactly 5 cards.');
  }
  const rules = Array.from(new Set(config.rules));
  const firstTurn: Owner = config.firstTurn ?? (rng() < 0.5 ? 'player' : 'opponent');
  const elementalActive = rules.includes('elemental');
  const board = createBoard(elementalActive, rng);

  return {
    matchId: config.matchId ?? `tt-${Date.now()}-${Math.floor(rng() * 1e6)}`,
    phase: 'playing',
    rules,
    tradeRule: config.tradeRule,
    board,
    playerHand: [...config.playerHand],
    opponentHand: [...config.opponentHand],
    originalPlayerHand: [...config.playerHand],
    originalOpponentHand: [...config.opponentHand],
    currentTurn: firstTurn,
    firstTurn,
    turnNumber: 1,
    suddenDeathRound: 1,
    scores: { player: 5, opponent: 5 },
    winner: null,
    lastTurn: null,
    history: [],
    tradeSummary: null,
  };
}

function buildTradeSummary(
  state: Pick<
    MatchState,
    'tradeRule' | 'board' | 'playerHand' | 'opponentHand' | 'originalPlayerHand' | 'originalOpponentHand'
  >,
  winner: Owner | 'draw',
  playerScore: number,
  opponentScore: number,
): TradePhaseSummary {
  if (state.tradeRule === 'direct') {
    const directGainedByPlayer: string[] = [];
    const directLostByPlayer: string[] = [];

    for (const cell of state.board) {
      if (!cell.placed) continue;
      if (cell.placed.originalOwner === 'opponent' && cell.placed.owner === 'player') {
        directGainedByPlayer.push(cell.placed.cardId);
      } else if (cell.placed.originalOwner === 'player' && cell.placed.owner === 'opponent') {
        directLostByPlayer.push(cell.placed.cardId);
      }
    }

    return {
      tradeRule: 'direct',
      winner,
      cardsToPick: 0,
      picker: null,
      playerPoolIds: [...state.originalPlayerHand],
      opponentPoolIds: [...state.originalOpponentHand],
      directGainedByPlayer,
      directLostByPlayer,
    };
  }

  if (winner === 'draw') {
    return {
      tradeRule: state.tradeRule,
      winner: 'draw',
      cardsToPick: 0,
      picker: null,
      playerPoolIds: [...state.originalPlayerHand],
      opponentPoolIds: [...state.originalOpponentHand],
      directGainedByPlayer: [],
      directLostByPlayer: [],
    };
  }

  let cardsToPick = 1;
  if (state.tradeRule === 'diff') {
    cardsToPick = Math.min(5, Math.abs(playerScore - opponentScore));
  } else if (state.tradeRule === 'all') {
    cardsToPick = 5;
  }

  return {
    tradeRule: state.tradeRule,
    winner,
    cardsToPick,
    picker: winner,
    playerPoolIds: [...state.originalPlayerHand],
    opponentPoolIds: [...state.originalOpponentHand],
    directGainedByPlayer: [],
    directLostByPlayer: [],
  };
}

export function applyMove(
  state: MatchState,
  move: MoveAction,
  cardsById: Readonly<Record<string, CardDefinition>> = CARDS_BY_ID,
): MatchState {
  if (state.phase !== 'playing') {
    throw new Error(`Cannot apply move while phase is ${state.phase}`);
  }
  if (move.actor !== state.currentTurn) {
    throw new Error(`It is ${state.currentTurn}'s turn, not ${move.actor}'s`);
  }

  const activeHand = move.actor === 'player' ? state.playerHand : state.opponentHand;
  if (move.handIndex < 0 || move.handIndex >= activeHand.length) {
    throw new Error(`Invalid hand index ${move.handIndex}`);
  }

  const cardId = activeHand[move.handIndex];
  const card = cardsById[cardId];
  if (!card) {
    throw new Error(`Unknown card ${cardId}`);
  }

  const { nextBoard, flipEvents, triggeredRules } = resolvePlacement(
    state.board,
    move.cellIndex,
    card,
    move.actor,
    state.rules,
    cardsById,
  );

  const nextPlayerHand =
    move.actor === 'player'
      ? state.playerHand.filter((_, i) => i !== move.handIndex)
      : [...state.playerHand];
  const nextOpponentHand =
    move.actor === 'opponent'
      ? state.opponentHand.filter((_, i) => i !== move.handIndex)
      : [...state.opponentHand];

  const scores = computeScores(nextBoard, nextPlayerHand.length, nextOpponentHand.length);
  const logEntry = {
    turnNumber: state.turnNumber,
    actor: move.actor,
    cardId,
    cellIndex: move.cellIndex,
    flips: flipEvents,
    triggeredRules,
  };

  const boardFull = nextBoard.every((cell) => cell.placed !== null);
  if (!boardFull) {
    return {
      ...state,
      board: nextBoard,
      playerHand: nextPlayerHand,
      opponentHand: nextOpponentHand,
      currentTurn: move.actor === 'player' ? 'opponent' : 'player',
      turnNumber: state.turnNumber + 1,
      scores,
      lastTurn: logEntry,
      history: [...state.history, logEntry],
    };
  }

  // Board is full (9 cards placed, 1 left in hand of second player)
  if (
    scores.player === 5 &&
    scores.opponent === 5 &&
    state.rules.includes('suddenDeath') &&
    state.suddenDeathRound < 10
  ) {
    return {
      ...state,
      phase: 'suddenDeathPending',
      board: nextBoard,
      playerHand: nextPlayerHand,
      opponentHand: nextOpponentHand,
      scores,
      winner: null,
      lastTurn: logEntry,
      history: [...state.history, logEntry],
      tradeSummary: null,
    };
  }

  const winner: Owner | 'draw' =
    scores.player > scores.opponent
      ? 'player'
      : scores.opponent > scores.player
        ? 'opponent'
        : 'draw';

  const tradeSummary = buildTradeSummary(
    {
      tradeRule: state.tradeRule,
      board: nextBoard,
      playerHand: nextPlayerHand,
      opponentHand: nextOpponentHand,
      originalPlayerHand: state.originalPlayerHand,
      originalOpponentHand: state.originalOpponentHand,
    },
    winner,
    scores.player,
    scores.opponent,
  );

  return {
    ...state,
    phase: 'finished',
    board: nextBoard,
    playerHand: nextPlayerHand,
    opponentHand: nextOpponentHand,
    scores,
    winner,
    lastTurn: logEntry,
    history: [...state.history, logEntry],
    tradeSummary,
  };
}

export function startSuddenDeathRound(
  state: MatchState,
  rng: () => number = Math.random,
): MatchState {
  if (state.phase !== 'suddenDeathPending') {
    throw new Error('Sudden Death can only start from suddenDeathPending phase');
  }

  const nextPlayerHand = [...state.playerHand];
  const nextOpponentHand = [...state.opponentHand];
  for (const cell of state.board) {
    if (!cell.placed) continue;
    if (cell.placed.owner === 'player') nextPlayerHand.push(cell.placed.cardId);
    else nextOpponentHand.push(cell.placed.cardId);
  }

  if (nextPlayerHand.length !== 5 || nextOpponentHand.length !== 5) {
    throw new Error(
      `Invalid Sudden Death hand sizes: player=${nextPlayerHand.length}, opponent=${nextOpponentHand.length}`,
    );
  }

  const nextStarter: Owner = state.firstTurn === 'player' ? 'opponent' : 'player';
  const elementalActive = state.rules.includes('elemental');

  return {
    ...state,
    phase: 'playing',
    board: createBoard(elementalActive, rng),
    playerHand: nextPlayerHand,
    opponentHand: nextOpponentHand,
    originalPlayerHand: [...nextPlayerHand],
    originalOpponentHand: [...nextOpponentHand],
    currentTurn: nextStarter,
    firstTurn: nextStarter,
    turnNumber: 1,
    suddenDeathRound: state.suddenDeathRound + 1,
    scores: { player: 5, opponent: 5 },
    winner: null,
    lastTurn: null,
    tradeSummary: null,
  };
}

export function resolveTrade(
  summary: TradePhaseSummary,
  chosenCardIds: readonly string[],
): TradeResolution {
  if (summary.tradeRule === 'direct') {
    return {
      gainedByPlayer: [...summary.directGainedByPlayer],
      lostByPlayer: [...summary.directLostByPlayer],
      protectedCardIds: [],
    };
  }

  if (summary.winner === 'draw' || summary.cardsToPick === 0) {
    return { gainedByPlayer: [], lostByPlayer: [], protectedCardIds: [] };
  }

  const targetPool =
    summary.winner === 'player' ? [...summary.opponentPoolIds] : [...summary.playerPoolIds];

  const picked: string[] = [];
  for (const id of chosenCardIds) {
    if (picked.length >= summary.cardsToPick) break;
    const idx = targetPool.indexOf(id);
    if (idx !== -1) {
      picked.push(id);
      targetPool.splice(idx, 1);
    }
  }
  while (picked.length < summary.cardsToPick && targetPool.length > 0) {
    picked.push(targetPool.shift()!);
  }

  if (summary.winner === 'player') {
    return { gainedByPlayer: picked, lostByPlayer: [], protectedCardIds: [] };
  }
  return { gainedByPlayer: [], lostByPlayer: picked, protectedCardIds: [] };
}

export function createAiPerceivedState(state: MatchState): PerceivedMatchState {
  const isOpen = state.rules.includes('open');
  return {
    phase: state.phase,
    rules: [...state.rules],
    tradeRule: state.tradeRule,
    board: state.board.map((c) => ({
      ...c,
      placed: c.placed ? { ...c.placed } : null,
    })),
    playerHandCount: state.playerHand.length,
    visiblePlayerHand: isOpen ? [...state.playerHand] : null,
    opponentHand: [...state.opponentHand],
    currentTurn: state.currentTurn,
    turnNumber: state.turnNumber,
    suddenDeathRound: state.suddenDeathRound,
    scores: { ...state.scores },
  };
}
