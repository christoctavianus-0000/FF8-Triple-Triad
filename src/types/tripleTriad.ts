export type ElementType =
  | 'none'
  | 'earth'
  | 'fire'
  | 'ice'
  | 'poison'
  | 'thunder'
  | 'water'
  | 'wind'
  | 'holy';

export type SpecialRule =
  | 'open'
  | 'same'
  | 'sameWall'
  | 'plus'
  | 'elemental'
  | 'random'
  | 'suddenDeath';

export type TradeRule = 'one' | 'diff' | 'direct' | 'all';

export type RegionId =
  | 'balamb'
  | 'galbadia'
  | 'dollet'
  | 'fh'
  | 'trabia'
  | 'centra'
  | 'esthar'
  | 'lunar';

export type Owner = 'player' | 'opponent';

export type CardCategory = 'monster' | 'boss' | 'gf' | 'character';

export type AiTier = 'novice' | 'standard' | 'master';

export interface CardRanks {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CardDefinition {
  index: number;
  id: string;
  name: string;
  level: number;
  category: CardCategory;
  ranks: CardRanks;
  element: ElementType;
  cardMod: string;
  isRare: boolean;
  imagePath: string;
}

export interface PlacedCard {
  cardId: string;
  owner: Owner;
  originalOwner: Owner;
}

export interface BoardCell {
  index: number;
  element: ElementType;
  placed: PlacedCard | null;
}

export type FlipTrigger = 'basic' | 'same' | 'sameWall' | 'plus' | 'combo';

export interface FlipEvent {
  wave: number;
  trigger: FlipTrigger;
  sourceIndex: number;
  flippedIndex: number;
  newOwner: Owner;
}

export interface TurnLogEntry {
  turnNumber: number;
  actor: Owner;
  cardId: string;
  cellIndex: number;
  flips: FlipEvent[];
  triggeredRules: Array<'same' | 'sameWall' | 'plus' | 'combo'>;
}

export type MatchPhase = 'playing' | 'suddenDeathPending' | 'finished';

export interface TradePhaseSummary {
  tradeRule: TradeRule;
  winner: Owner | 'draw';
  cardsToPick: number;
  picker: Owner | null;
  playerPoolIds: string[];
  opponentPoolIds: string[];
  directGainedByPlayer: string[];
  directLostByPlayer: string[];
}

export interface MatchState {
  matchId: string;
  phase: MatchPhase;
  rules: SpecialRule[];
  tradeRule: TradeRule;
  board: BoardCell[];
  playerHand: string[];
  opponentHand: string[];
  originalPlayerHand: string[];
  originalOpponentHand: string[];
  currentTurn: Owner;
  firstTurn: Owner;
  turnNumber: number;
  suddenDeathRound: number;
  scores: {
    player: number;
    opponent: number;
  };
  winner: Owner | 'draw' | null;
  lastTurn: TurnLogEntry | null;
  history: TurnLogEntry[];
  tradeSummary: TradePhaseSummary | null;
}

export interface PerceivedMatchState {
  phase: MatchPhase;
  rules: SpecialRule[];
  tradeRule: TradeRule;
  board: BoardCell[];
  playerHandCount: number;
  visiblePlayerHand: string[] | null;
  opponentHand: string[];
  currentTurn: Owner;
  turnNumber: number;
  suddenDeathRound: number;
  scores: {
    player: number;
    opponent: number;
  };
}

export interface MoveAction {
  actor: Owner;
  handIndex: number;
  cellIndex: number;
}

export interface TradeResolution {
  gainedByPlayer: string[];
  lostByPlayer: string[];
  protectedCardIds: string[];
}

export interface RegionState {
  id: RegionId;
  specialRules: SpecialRule[];
  tradeRule: TradeRule;
}

export interface RegionDefinition {
  id: RegionId;
  name: string;
  subtitle: string;
  defaultRules: SpecialRule[];
  defaultTradeRule: TradeRule;
  accentColor: string;
  description: string;
}

export interface NpcDefinition {
  id: string;
  name: string;
  title: string;
  regionId: RegionId;
  location: string;
  deckLevels: number[];
  rareCardIds: string[];
  aiTier: AiTier;
  unlockRequirement?: {
    defeatedNpcIds?: string[];
    ccStageMin?: number;
  };
  isRuleResetter?: boolean;
  isQueenOfCards?: boolean;
  isCcMember?: boolean;
  ccRank?: number;
  greeting: string;
  victoryLine: string;
  defeatLine: string;
}

export interface QueenQuestStep {
  step: number;
  loseCardId: string;
  forgedCardId: string;
  reclaimNpcId: string;
  description: string;
}

export type RareCardHolder = 'player' | 'unforged' | 'queen' | `npc:${string}`;

export interface SavedDeck {
  id: string;
  name: string;
  cards: string[];
}

export interface ProfileState {
  version: number;
  collection: Record<string, number>;
  everCollectedIds: string[];
  lostCardHolders: Record<string, RareCardHolder>;
  rareCardHolders: Record<string, RareCardHolder>;
  regions: Record<RegionId, RegionState>;
  carriedRegionId: RegionId | null;
  carriedRules: SpecialRule[];
  dominanceRegionId: RegionId;
  dominanceLevel: number;
  degenerationCounter: number;
  queenRegionId: RegionId;
  queenTradeRule: TradeRule;
  queenQuestStep: number;
  queenForgedCardIds: string[];
  defeatedNpcIds: string[];
  ccGroupStage: number;
  decks: SavedDeck[];
  activeDeckId: string;
  lastDeckIds: string[];
  settings: {
    soundEnabled: boolean;
    bgmEnabled: boolean;
    ruleSpreadEnabled: boolean;
    sandboxMode: boolean;
    showHints: boolean;
  };
  stats: {
    wins: number;
    losses: number;
    draws: number;
    totalFlips: number;
    maxComboWave: number;
    currentStreak: number;
    bestStreak: number;
  };
}
