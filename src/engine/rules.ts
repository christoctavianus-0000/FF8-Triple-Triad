import type {
  BoardCell,
  CardDefinition,
  CardRanks,
  ElementType,
  FlipEvent,
  Owner,
  SpecialRule,
} from '../types/tripleTriad';

export type Side = 'top' | 'right' | 'bottom' | 'left';

interface NeighborDef {
  side: Side;
  opposite: Side;
  dRow: number;
  dCol: number;
}

const DIRECTIONS: readonly NeighborDef[] = [
  { side: 'top', opposite: 'bottom', dRow: -1, dCol: 0 },
  { side: 'right', opposite: 'left', dRow: 0, dCol: 1 },
  { side: 'bottom', opposite: 'top', dRow: 1, dCol: 0 },
  { side: 'left', opposite: 'right', dRow: 0, dCol: -1 },
];

export function getElementalModifier(
  cardElement: ElementType,
  cellElement: ElementType,
  elementalActive: boolean,
): -1 | 0 | 1 {
  if (!elementalActive || cellElement === 'none') return 0;
  return cardElement === cellElement ? 1 : -1;
}

export function getEffectiveRanks(
  card: CardDefinition,
  cellElement: ElementType,
  elementalActive: boolean,
): CardRanks {
  const mod = getElementalModifier(card.element, cellElement, elementalActive);
  return {
    top: card.ranks.top + mod,
    right: card.ranks.right + mod,
    bottom: card.ranks.bottom + mod,
    left: card.ranks.left + mod,
  };
}

export function formatRank(value: number): string {
  if (value >= 10) return value === 10 ? 'A' : String(value);
  return String(value);
}

export interface PlacementResult {
  nextBoard: BoardCell[];
  flipEvents: FlipEvent[];
  triggeredRules: Array<'same' | 'sameWall' | 'plus' | 'combo'>;
}

export function resolvePlacement(
  board: readonly BoardCell[],
  cellIndex: number,
  card: CardDefinition,
  owner: Owner,
  activeRules: readonly SpecialRule[],
  cardsById: Readonly<Record<string, CardDefinition>>,
): PlacementResult {
  if (cellIndex < 0 || cellIndex >= 9) {
    throw new Error(`Invalid board cell index: ${cellIndex}`);
  }
  if (board[cellIndex].placed !== null) {
    throw new Error(`Board cell ${cellIndex} is already occupied`);
  }

  const ruleSet = new Set(activeRules);
  const elementalActive = ruleSet.has('elemental');
  const sameActive = ruleSet.has('same');
  // Same Wall has no effect unless Same is also active.
  const sameWallActive = sameActive && ruleSet.has('sameWall');
  const plusActive = ruleSet.has('plus');

  const nextBoard: BoardCell[] = board.map((cell, idx) =>
    idx === cellIndex
      ? {
          ...cell,
          placed: {
            cardId: card.id,
            owner,
            originalOwner: owner,
          },
        }
      : {
          ...cell,
          placed: cell.placed ? { ...cell.placed } : null,
        },
  );

  const flipEvents: FlipEvent[] = [];
  const triggered = new Set<'same' | 'sameWall' | 'plus' | 'combo'>();
  const comboQueue: Array<{ index: number; wave: number }> = [];

  const row = Math.floor(cellIndex / 3);
  const col = cellIndex % 3;

  const getNeighbor = (baseIdx: number, dir: NeighborDef): number | null => {
    const r = Math.floor(baseIdx / 3) + dir.dRow;
    const c = (baseIdx % 3) + dir.dCol;
    if (r < 0 || r >= 3 || c < 0 || c >= 3) return null;
    return r * 3 + c;
  };

  // 1. SAME & SAME WALL (uses printed base ranks; ignores Elemental modifiers)
  if (sameActive) {
    const matchedOpponentIndices: number[] = [];
    let realMatches = 0;
    let wallMatches = 0;

    for (const dir of DIRECTIONS) {
      const nIdx = getNeighbor(cellIndex, dir);
      const placedRank = card.ranks[dir.side];

      if (nIdx === null) {
        if (sameWallActive && placedRank === 10) {
          wallMatches += 1;
        }
        continue;
      }

      const neighborPlaced = nextBoard[nIdx].placed;
      if (!neighborPlaced) continue;
      const neighborCard = cardsById[neighborPlaced.cardId];
      if (placedRank === neighborCard.ranks[dir.opposite]) {
        realMatches += 1;
        if (neighborPlaced.owner !== owner) {
          matchedOpponentIndices.push(nIdx);
        }
      }
    }

    const totalMatches = realMatches + wallMatches;
    if (totalMatches >= 2 && matchedOpponentIndices.length >= 1) {
      const usedWall = wallMatches > 0;
      const triggerType: 'same' | 'sameWall' = usedWall ? 'sameWall' : 'same';
      triggered.add(triggerType);

      for (const targetIdx of matchedOpponentIndices) {
        const target = nextBoard[targetIdx].placed;
        if (target && target.owner !== owner) {
          target.owner = owner;
          flipEvents.push({
            wave: 1,
            trigger: triggerType,
            sourceIndex: cellIndex,
            flippedIndex: targetIdx,
            newOwner: owner,
          });
          comboQueue.push({ index: targetIdx, wave: 1 });
        }
      }
    }
  }

  // 2. PLUS (uses printed base ranks; ignores Elemental modifiers)
  if (plusActive) {
    const sumGroups = new Map<number, Array<{ idx: number; isOpponent: boolean }>>();

    for (const dir of DIRECTIONS) {
      const nIdx = getNeighbor(cellIndex, dir);
      if (nIdx === null) continue;
      const neighborPlaced = nextBoard[nIdx].placed;
      if (!neighborPlaced) continue;
      const neighborCard = cardsById[neighborPlaced.cardId];
      const sum = card.ranks[dir.side] + neighborCard.ranks[dir.opposite];
      const list = sumGroups.get(sum) ?? [];
      list.push({ idx: nIdx, isOpponent: neighborPlaced.owner !== owner });
      sumGroups.set(sum, list);
    }

    for (const group of sumGroups.values()) {
      if (group.length >= 2 && group.some((entry) => entry.isOpponent)) {
        triggered.add('plus');
        for (const entry of group) {
          const target = nextBoard[entry.idx].placed;
          if (target && target.owner !== owner) {
            target.owner = owner;
            flipEvents.push({
              wave: 1,
              trigger: 'plus',
              sourceIndex: cellIndex,
              flippedIndex: entry.idx,
              newOwner: owner,
            });
            comboQueue.push({ index: entry.idx, wave: 1 });
          }
        }
      }
    }
  }

  // 3. COMBO CASCADE (only triggered by cards flipped via Same / Same Wall / Plus; uses effective ranks!)
  while (comboQueue.length > 0) {
    const current = comboQueue.shift()!;
    const sourceCell = nextBoard[current.index];
    if (!sourceCell.placed) continue;
    const sourceCard = cardsById[sourceCell.placed.cardId];
    const sourceRanks = getEffectiveRanks(sourceCard, sourceCell.element, elementalActive);

    for (const dir of DIRECTIONS) {
      const nIdx = getNeighbor(current.index, dir);
      if (nIdx === null) continue;
      const neighborCell = nextBoard[nIdx];
      if (!neighborCell.placed || neighborCell.placed.owner === owner) continue;
      const neighborCard = cardsById[neighborCell.placed.cardId];
      const neighborRanks = getEffectiveRanks(neighborCard, neighborCell.element, elementalActive);

      if (sourceRanks[dir.side] > neighborRanks[dir.opposite]) {
        neighborCell.placed.owner = owner;
        triggered.add('combo');
        const nextWave = current.wave + 1;
        flipEvents.push({
          wave: nextWave,
          trigger: 'combo',
          sourceIndex: current.index,
          flippedIndex: nIdx,
          newOwner: owner,
        });
        comboQueue.push({ index: nIdx, wave: nextWave });
      }
    }
  }

  // 4. BASIC CAPTURES (uses effective ranks with Elemental ±1; NEVER triggers Combo)
  const placedEffective = getEffectiveRanks(card, nextBoard[cellIndex].element, elementalActive);
  for (const dir of DIRECTIONS) {
    const r = row + dir.dRow;
    const c = col + dir.dCol;
    if (r < 0 || r >= 3 || c < 0 || c >= 3) continue;
    const nIdx = r * 3 + c;
    const neighborCell = nextBoard[nIdx];
    if (!neighborCell.placed || neighborCell.placed.owner === owner) continue;
    const neighborCard = cardsById[neighborCell.placed.cardId];
    const neighborEffective = getEffectiveRanks(neighborCard, neighborCell.element, elementalActive);

    if (placedEffective[dir.side] > neighborEffective[dir.opposite]) {
      neighborCell.placed.owner = owner;
      flipEvents.push({
        wave: 0,
        trigger: 'basic',
        sourceIndex: cellIndex,
        flippedIndex: nIdx,
        newOwner: owner,
      });
    }
  }

  return {
    nextBoard,
    flipEvents,
    triggeredRules: Array.from(triggered),
  };
}
