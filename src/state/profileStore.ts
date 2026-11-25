import { ALL_CARDS, CARDS_BY_ID } from '../data/cards';
import { NPCS, NPCS_BY_ID, QUEEN_FORGED_CARD_IDS, QUEEN_QUEST_STEPS } from '../data/opponents';
import { REGION_ORDER, REGIONS } from '../data/regions';
import type {
  MatchState,
  ProfileState,
  RareCardHolder,
  RegionId,
  RegionState,
  SpecialRule,
  TradeResolution,
  TradeRule,
} from '../types/tripleTriad';

export const PROFILE_STORAGE_KEY = 'ff8_tt_profile_v1';

export const STARTER_CARD_IDS: readonly string[] = [
  'geezard',
  'funguar',
  'bite-bug',
  'red-bat',
  'blobra',
  'gayla',
  'gesper',
];

const VALID_SPECIAL_RULES = new Set<SpecialRule>([
  'open',
  'same',
  'sameWall',
  'plus',
  'elemental',
  'random',
  'suddenDeath',
]);

const VALID_TRADE_RULES = new Set<TradeRule>(['one', 'diff', 'direct', 'all']);

export function createInitialRareHolders(): Record<string, RareCardHolder> {
  const holders: Record<string, RareCardHolder> = {};
  const forgedSet = new Set(QUEEN_FORGED_CARD_IDS);

  for (const card of ALL_CARDS) {
    if (!card.isRare) continue;
    holders[card.id] = forgedSet.has(card.id) ? 'unforged' : 'unforged';
  }
  for (const npc of NPCS) {
    for (const rareId of npc.rareCardIds) {
      if (forgedSet.has(rareId)) {
        holders[rareId] = 'unforged';
      } else {
        holders[rareId] = `npc:${npc.id}`;
      }
    }
  }
  return holders;
}

export function createInitialRegions(): Record<RegionId, RegionState> {
  const regions = {} as Record<RegionId, RegionState>;
  for (const id of REGION_ORDER) {
    regions[id] = {
      id,
      specialRules: [...REGIONS[id].defaultRules],
      tradeRule: REGIONS[id].defaultTradeRule,
    };
  }
  return regions;
}

export function createDefaultProfile(): ProfileState {
  const collection: Record<string, number> = {};
  for (const id of STARTER_CARD_IDS) {
    collection[id] = 1;
  }

  return {
    version: 1,
    collection,
    rareCardHolders: createInitialRareHolders(),
    regions: createInitialRegions(),
    carriedRegionId: 'balamb',
    carriedRules: [...REGIONS.balamb.defaultRules],
    dominanceRegionId: 'balamb',
    dominanceLevel: 1,
    degenerationCounter: 0,
    queenRegionId: 'dollet',
    queenTradeRule: 'one',
    queenQuestStep: 0,
    queenForgedCardIds: [],
    defeatedNpcIds: [],
    ccGroupStage: 0,
    lastDeckIds: STARTER_CARD_IDS.slice(0, 5),
    settings: {
      soundEnabled: true,
      bgmEnabled: false,
      ruleSpreadEnabled: true,
      sandboxMode: false,
      showHints: true,
    },
    stats: {
      wins: 0,
      losses: 0,
      draws: 0,
      totalFlips: 0,
      maxComboWave: 0,
      currentStreak: 0,
      bestStreak: 0,
    },
  };
}

export function getTotalCardCount(collection: Readonly<Record<string, number>>): number {
  let total = 0;
  for (const count of Object.values(collection)) {
    if (count > 0) total += count;
  }
  return total;
}

export function getUniqueCollectedCount(collection: Readonly<Record<string, number>>): number {
  let count = 0;
  for (const card of ALL_CARDS) {
    if ((collection[card.id] ?? 0) > 0) count += 1;
  }
  return count;
}

export function getEffectiveCollection(profile: ProfileState): Record<string, number> {
  if (!profile.settings.sandboxMode) {
    return profile.collection;
  }
  const all: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    all[card.id] = card.isRare ? 1 : Math.max(5, profile.collection[card.id] ?? 5);
  }
  return all;
}

export function sanitizeProfile(raw: unknown): ProfileState {
  const fallback = createDefaultProfile();
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Partial<ProfileState>;

  const collection: Record<string, number> = {};
  if (obj.collection && typeof obj.collection === 'object') {
    for (const [id, count] of Object.entries(obj.collection)) {
      const card = CARDS_BY_ID[id];
      if (!card || typeof count !== 'number' || !Number.isFinite(count)) continue;
      const clamped = card.isRare ? Math.min(1, Math.floor(count)) : Math.min(99, Math.floor(count));
      if (clamped > 0) collection[id] = clamped;
    }
  }
  if (getTotalCardCount(collection) < 5) {
    for (const id of STARTER_CARD_IDS) {
      if (getTotalCardCount(collection) >= 7) break;
      collection[id] = Math.max(1, collection[id] ?? 0);
    }
  }

  const rareCardHolders = createInitialRareHolders();
  if (obj.rareCardHolders && typeof obj.rareCardHolders === 'object') {
    for (const [id, holder] of Object.entries(obj.rareCardHolders)) {
      if (!CARDS_BY_ID[id]?.isRare || typeof holder !== 'string') continue;
      if (
        holder === 'player' ||
        holder === 'unforged' ||
        holder === 'queen' ||
        (holder.startsWith('npc:') && NPCS_BY_ID[holder.slice(4)])
      ) {
        rareCardHolders[id] = holder as RareCardHolder;
      }
    }
  }
  // Keep collection & rareCardHolders consistent
  for (const card of ALL_CARDS) {
    if (!card.isRare) continue;
    if ((collection[card.id] ?? 0) > 0) {
      rareCardHolders[card.id] = 'player';
    } else if (rareCardHolders[card.id] === 'player') {
      collection[card.id] = 1;
    }
  }

  const regions = createInitialRegions();
  if (obj.regions && typeof obj.regions === 'object') {
    for (const id of REGION_ORDER) {
      const saved = obj.regions[id];
      if (!saved || typeof saved !== 'object') continue;
      const specialRules = Array.isArray(saved.specialRules)
        ? Array.from(new Set(saved.specialRules.filter((r): r is SpecialRule => VALID_SPECIAL_RULES.has(r))))
        : regions[id].specialRules;
      const tradeRule = VALID_TRADE_RULES.has(saved.tradeRule)
        ? saved.tradeRule
        : regions[id].tradeRule;
      regions[id] = { id, specialRules, tradeRule };
    }
  }

  const queenRegionId: RegionId =
    obj.queenRegionId && REGION_ORDER.includes(obj.queenRegionId)
      ? obj.queenRegionId
      : fallback.queenRegionId;

  const queenTradeRule: TradeRule =
    obj.queenTradeRule && VALID_TRADE_RULES.has(obj.queenTradeRule)
      ? obj.queenTradeRule
      : fallback.queenTradeRule;

  const dominanceRegionId: RegionId =
    obj.dominanceRegionId && REGION_ORDER.includes(obj.dominanceRegionId)
      ? obj.dominanceRegionId
      : fallback.dominanceRegionId;

  const carriedRegionId: RegionId | null =
    obj.carriedRegionId && REGION_ORDER.includes(obj.carriedRegionId)
      ? obj.carriedRegionId
      : null;

  const carriedRules = Array.isArray(obj.carriedRules)
    ? Array.from(new Set(obj.carriedRules.filter((r): r is SpecialRule => VALID_SPECIAL_RULES.has(r))))
    : fallback.carriedRules;

  const defeatedNpcIds = Array.isArray(obj.defeatedNpcIds)
    ? Array.from(new Set(obj.defeatedNpcIds.filter((id) => Boolean(NPCS_BY_ID[id]))))
    : [];

  const queenForgedCardIds = Array.isArray(obj.queenForgedCardIds)
    ? Array.from(new Set(obj.queenForgedCardIds.filter((id) => Boolean(CARDS_BY_ID[id]))))
    : [];

  const lastDeckIds = Array.isArray(obj.lastDeckIds)
    ? obj.lastDeckIds.filter((id) => Boolean(CARDS_BY_ID[id])).slice(0, 5)
    : fallback.lastDeckIds;

  return {
    version: 1,
    collection,
    rareCardHolders,
    regions,
    carriedRegionId,
    carriedRules,
    dominanceRegionId,
    dominanceLevel:
      typeof obj.dominanceLevel === 'number' && Number.isFinite(obj.dominanceLevel)
        ? Math.max(0, Math.min(10, Math.floor(obj.dominanceLevel)))
        : fallback.dominanceLevel,
    degenerationCounter:
      typeof obj.degenerationCounter === 'number' && Number.isFinite(obj.degenerationCounter)
        ? Math.max(0, Math.min(256, Math.floor(obj.degenerationCounter)))
        : fallback.degenerationCounter,
    queenRegionId,
    queenTradeRule,
    queenQuestStep:
      typeof obj.queenQuestStep === 'number' && Number.isFinite(obj.queenQuestStep)
        ? Math.max(0, Math.min(QUEEN_QUEST_STEPS.length, Math.floor(obj.queenQuestStep)))
        : 0,
    queenForgedCardIds,
    defeatedNpcIds,
    ccGroupStage:
      typeof obj.ccGroupStage === 'number' && Number.isFinite(obj.ccGroupStage)
        ? Math.max(0, Math.min(7, Math.floor(obj.ccGroupStage)))
        : 0,
    lastDeckIds,
    settings: {
      soundEnabled: obj.settings?.soundEnabled ?? true,
      bgmEnabled: obj.settings?.bgmEnabled ?? false,
      ruleSpreadEnabled: obj.settings?.ruleSpreadEnabled ?? true,
      sandboxMode: obj.settings?.sandboxMode ?? false,
      showHints: obj.settings?.showHints ?? true,
    },
    stats: {
      wins: Math.max(0, Math.floor(obj.stats?.wins ?? 0)),
      losses: Math.max(0, Math.floor(obj.stats?.losses ?? 0)),
      draws: Math.max(0, Math.floor(obj.stats?.draws ?? 0)),
      totalFlips: Math.max(0, Math.floor(obj.stats?.totalFlips ?? 0)),
      maxComboWave: Math.max(0, Math.floor(obj.stats?.maxComboWave ?? 0)),
      currentStreak: Math.max(0, Math.floor(obj.stats?.currentStreak ?? 0)),
      bestStreak: Math.max(0, Math.floor(obj.stats?.bestStreak ?? 0)),
    },
  };
}

export function loadProfile(): ProfileState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultProfile();
  }
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return createDefaultProfile();
    return sanitizeProfile(JSON.parse(raw));
  } catch {
    return createDefaultProfile();
  }
}

export function saveProfile(profile: ProfileState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function resetProfile(): ProfileState {
  const fresh = createDefaultProfile();
  saveProfile(fresh);
  return fresh;
}

export interface ProfileTradeOutcome {
  profile: ProfileState;
  appliedTrade: TradeResolution;
  queenForgeMessages: string[];
}

export function applyTradeToProfile(
  profile: ProfileState,
  trade: TradeResolution,
  opponentNpcId: string | null,
  skipCollectionMutation: boolean,
): ProfileTradeOutcome {
  if (skipCollectionMutation) {
    return {
      profile,
      appliedTrade: { gainedByPlayer: [], lostByPlayer: [], protectedCardIds: [] },
      queenForgeMessages: [],
    };
  }

  const nextCollection: Record<string, number> = { ...profile.collection };
  const nextHolders: Record<string, RareCardHolder> = { ...profile.rareCardHolders };
  const nextForged = new Set(profile.queenForgedCardIds);
  const queenForgeMessages: string[] = [];

  const gainedApplied: string[] = [];
  for (const id of trade.gainedByPlayer) {
    const card = CARDS_BY_ID[id];
    if (!card) continue;
    if (card.isRare) {
      if ((nextCollection[id] ?? 0) === 0) {
        nextCollection[id] = 1;
        nextHolders[id] = 'player';
        gainedApplied.push(id);
      }
    } else {
      nextCollection[id] = Math.min(99, (nextCollection[id] ?? 0) + 1);
      gainedApplied.push(id);
    }
  }

  const lostApplied: string[] = [];
  const protectedCardIds: string[] = [];

  for (const id of trade.lostByPlayer) {
    const card = CARDS_BY_ID[id];
    if (!card) continue;
    const currentCount = nextCollection[id] ?? 0;
    if (currentCount <= 0) continue;

    // 5-card softlock protection: never drop total cards below 5
    if (getTotalCardCount(nextCollection) <= 5) {
      protectedCardIds.push(id);
      continue;
    }

    if (currentCount === 1) {
      delete nextCollection[id];
    } else {
      nextCollection[id] = currentCount - 1;
    }
    lostApplied.push(id);

    if (card.isRare) {
      const targetHolder: RareCardHolder = opponentNpcId ? `npc:${opponentNpcId}` : 'queen';
      nextHolders[id] = targetHolder;

      // Check Queen of Cards rare card creation quest
      if (opponentNpcId === 'queen-of-cards') {
        const step = QUEEN_QUEST_STEPS.find(
          (s) => s.loseCardId === id && !nextForged.has(s.forgedCardId),
        );
        if (step) {
          nextForged.add(step.forgedCardId);
          nextHolders[step.forgedCardId] = `npc:${step.reclaimNpcId}`;
          const forgedCard = CARDS_BY_ID[step.forgedCardId];
          const holderNpc = NPCS_BY_ID[step.reclaimNpcId];
          queenForgeMessages.push(
            `The Queen of Cards painted a new rare card: ${forgedCard.name}! Find it with ${holderNpc.name} (${holderNpc.location}).`,
          );
        }
      }
    }
  }

  const completedCount = QUEEN_QUEST_STEPS.filter((s) =>
    nextForged.has(s.forgedCardId),
  ).length;

  return {
    profile: {
      ...profile,
      collection: nextCollection,
      rareCardHolders: nextHolders,
      queenForgedCardIds: Array.from(nextForged),
      queenQuestStep: completedCount,
    },
    appliedTrade: {
      gainedByPlayer: gainedApplied,
      lostByPlayer: lostApplied,
      protectedCardIds,
    },
    queenForgeMessages,
  };
}

export function updateStatsAfterMatch(
  profile: ProfileState,
  match: MatchState,
  npcId: string | null,
): ProfileState {
  if (match.phase !== 'finished' || !match.winner) return profile;

  const isWin = match.winner === 'player';
  const isLoss = match.winner === 'opponent';
  const isDraw = match.winner === 'draw';

  let flips = 0;
  let maxWave = profile.stats.maxComboWave;
  for (const entry of match.history) {
    if (entry.actor === 'player') {
      flips += entry.flips.length;
      for (const f of entry.flips) {
        if (f.wave > maxWave) maxWave = f.wave;
      }
    }
  }

  const nextStreak = isWin ? profile.stats.currentStreak + 1 : isLoss ? 0 : profile.stats.currentStreak;
  const bestStreak = Math.max(profile.stats.bestStreak, nextStreak);

  const nextDefeated = new Set(profile.defeatedNpcIds);
  let nextCcStage = profile.ccGroupStage;
  if (isWin && npcId) {
    nextDefeated.add(npcId);
    const npc = NPCS_BY_ID[npcId];
    if (npc?.isCcMember && npc.ccRank && npc.ccRank > nextCcStage) {
      nextCcStage = npc.ccRank;
    }
  }

  return {
    ...profile,
    defeatedNpcIds: Array.from(nextDefeated),
    ccGroupStage: nextCcStage,
    stats: {
      wins: profile.stats.wins + (isWin ? 1 : 0),
      losses: profile.stats.losses + (isLoss ? 1 : 0),
      draws: profile.stats.draws + (isDraw ? 1 : 0),
      totalFlips: profile.stats.totalFlips + flips,
      maxComboWave: maxWave,
      currentStreak: nextStreak,
      bestStreak,
    },
  };
}
