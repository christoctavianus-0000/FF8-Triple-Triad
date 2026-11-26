import React, { useMemo, useState } from 'react';
import { Award, MapPin, Search, X } from 'lucide-react';
import { ALL_CARDS, CARDS_BY_ID } from '../data/cards';
import { NPCS, NPCS_BY_ID, QUEEN_QUEST_STEPS } from '../data/opponents';
import { REGIONS } from '../data/regions';
import { formatRank } from '../engine/rules';
import { soundEngine } from '../audio/soundEngine';
import type {
  CardDefinition,
  ElementType,
  ProfileState,
  RareCardHolder,
  RegionId,
} from '../types/tripleTriad';
import { CardView } from './CardView';
import { MobileSheet } from './MobileSheet';

interface CardBinderProps {
  profile: ProfileState;
  onJumpToRegion?: (regionId: RegionId) => void;
}

const ELEMENTS: readonly ElementType[] = [
  'none',
  'earth',
  'fire',
  'ice',
  'poison',
  'thunder',
  'water',
  'wind',
  'holy',
];

interface RecoveryInfo {
  shortLabel: string;
  detail: string;
  targetRegionId: RegionId | null;
}

function resolveHolderMeta(
  holder: RareCardHolder | undefined,
  queenRegionId: RegionId,
): { label: string; location: string; regionId: RegionId | null } {
  if (!holder) return { label: 'Unknown', location: 'Unknown', regionId: null };
  if (holder === 'queen') {
    return {
      label: 'Queen of Cards',
      location: `${REGIONS[queenRegionId].name} (Travels Across Regions)`,
      regionId: queenRegionId,
    };
  }
  if (holder.startsWith('npc:')) {
    const npc = NPCS_BY_ID[holder.slice(4)];
    if (npc) {
      const rid = npc.isQueenOfCards ? queenRegionId : npc.regionId;
      return {
        label: npc.name,
        location: `${REGIONS[rid].name} (${npc.location})`,
        regionId: rid,
      };
    }
  }
  return { label: 'Unknown', location: 'Unknown', regionId: null };
}

export const CardBinder: React.FC<CardBinderProps> = ({ profile, onJumpToRegion }) => {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all');
  const [elemFilter, setElemFilter] = useState<ElementType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'owned' | 'lost'>('all');
  const [inspectedCard, setInspectedCard] = useState<CardDefinition | null>(null);

  const uniqueOwned = useMemo(
    () => ALL_CARDS.filter((c) => (profile.collection[c.id] ?? 0) > 0).length,
    [profile.collection],
  );

  const everCollectedSet = useMemo(
    () => new Set([...profile.everCollectedIds, ...Object.keys(profile.collection)]),
    [profile.everCollectedIds, profile.collection],
  );

  const lostCount = useMemo(
    () =>
      ALL_CARDS.filter(
        (c) =>
          (profile.collection[c.id] ?? 0) === 0 &&
          (everCollectedSet.has(c.id) || Boolean(profile.lostCardHolders[c.id])),
      ).length,
    [profile.collection, everCollectedSet, profile.lostCardHolders],
  );

  const isCardLost = (cardId: string): boolean =>
    (profile.collection[cardId] ?? 0) === 0 &&
    (everCollectedSet.has(cardId) || Boolean(profile.lostCardHolders[cardId]));

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_CARDS.filter((card) => {
      const owned = (profile.collection[card.id] ?? 0) > 0;
      const lost =
        !owned &&
        (everCollectedSet.has(card.id) || Boolean(profile.lostCardHolders[card.id]));

      if (levelFilter !== 'all' && card.level !== levelFilter) return false;
      if (elemFilter !== 'all' && card.element !== elemFilter) return false;
      if (statusFilter === 'owned' && !owned) return false;
      if (statusFilter === 'lost' && !lost) return false;
      if (q && !card.name.toLowerCase().includes(q) && !card.cardMod.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [
    search,
    levelFilter,
    elemFilter,
    statusFilter,
    profile.collection,
    everCollectedSet,
    profile.lostCardHolders,
  ]);

  const getRecoveryInfo = (card: CardDefinition): RecoveryInfo => {
    const owned = (profile.collection[card.id] ?? 0) > 0;
    const lost = isCardLost(card.id);

    if (owned) {
      return {
        shortLabel: 'In Collection',
        detail: 'Held by Squall (In your collection).',
        targetRegionId: null,
      };
    }

    if (card.isRare) {
      const holder = profile.rareCardHolders[card.id];
      if (holder === 'unforged') {
        const quest = QUEEN_QUEST_STEPS.find((s) => s.forgedCardId === card.id);
        if (quest) {
          const loseName = CARDS_BY_ID[quest.loseCardId]?.name ?? quest.loseCardId;
          const reclaimNpc = NPCS_BY_ID[quest.reclaimNpcId];
          const queenRegionName = REGIONS[profile.queenRegionId].name;
          return {
            shortLabel: `Queen Quest (${queenRegionName})`,
            detail: `Not yet forged. Lose ${loseName} to the Queen of Cards in ${queenRegionName}, then win ${card.name} from ${reclaimNpc?.name ?? 'her contact'} (${reclaimNpc?.location ?? ''}).`,
            targetRegionId: profile.queenRegionId,
          };
        }
        return {
          shortLabel: 'Queen Quest',
          detail: 'Not yet forged — advance the Queen of Cards quest!',
          targetRegionId: profile.queenRegionId,
        };
      }

      const meta = resolveHolderMeta(holder, profile.queenRegionId);
      return {
        shortLabel: meta.label,
        detail: lost
          ? `Lost card! Challenge ${meta.label} in ${meta.location} to win ${card.name} back.`
          : `Held by ${meta.label} in ${meta.location}.`,
        targetRegionId: meta.regionId,
      };
    }

    // Common Lv 1-7 card
    const matchingNpcs = NPCS.filter(
      (n) => !n.isQueenOfCards && n.deckLevels.includes(card.level),
    ).slice(0, 3);
    const farmHints = matchingNpcs
      .map((n) => `${n.name} (${REGIONS[n.regionId].name})`)
      .join(', ');

    const lostHolder = profile.lostCardHolders[card.id];
    if (lost && lostHolder) {
      const meta = resolveHolderMeta(lostHolder, profile.queenRegionId);
      return {
        shortLabel: meta.label,
        detail: `Lost to ${meta.label} in ${meta.location}. Reclaim a copy by defeating Lv${card.level} players such as ${farmHints}.`,
        targetRegionId: meta.regionId ?? matchingNpcs[0]?.regionId ?? null,
      };
    }

    return {
      shortLabel: matchingNpcs[0]?.name ?? `Lv${card.level} Duelists`,
      detail: `Common Lv${card.level} card — won from regional NPCs such as ${farmHints}.`,
      targetRegionId: matchingNpcs[0]?.regionId ?? null,
    };
  };

  const inspectedRecovery = inspectedCard ? getRecoveryInfo(inspectedCard) : null;
  const inspectedOwned = inspectedCard ? (profile.collection[inspectedCard.id] ?? 0) > 0 : false;
  const inspectedLost = inspectedCard ? isCardLost(inspectedCard.id) : false;

  return (
    <div className="tt-binder">
      <div className="tt-window tt-binder-header">
        <div className="tt-panel-head">
          <div>
            <h2>
              Card Album — {uniqueOwned} / 110{' '}
              {uniqueOwned === 110 && <Award size={18} className="tt-text-gold" />}
            </h2>
            <p className="tt-muted">
              Collect all 110 cards across Levels 1–10. Any card you owned and lost remains
              revealed in gray with recovery details.
            </p>
          </div>
          <div className="tt-search-box">
            <Search size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or Card Mod…"
              aria-label="Search cards"
            />
            {search && (
              <button
                type="button"
                className="tt-icon-btn"
                aria-label="Clear search"
                onClick={() => setSearch('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="tt-binder-filters">
          <div className="tt-level-tabs">
            <button
              type="button"
              className={`tt-tab ${levelFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setLevelFilter('all')}
            >
              All
            </button>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`tt-tab ${levelFilter === lvl ? 'is-active' : ''}`}
                onClick={() => setLevelFilter(lvl)}
              >
                Lv{lvl}
              </button>
            ))}
          </div>

          <div className="tt-btn-row">
            <select
              className="tt-select"
              aria-label="Filter by element"
              value={elemFilter}
              onChange={(e) => setElemFilter(e.target.value as ElementType | 'all')}
            >
              <option value="all">All Elements</option>
              {ELEMENTS.map((el) => (
                <option key={el} value={el}>
                  {el === 'none' ? 'Non-Elemental' : el.charAt(0).toUpperCase() + el.slice(1)}
                </option>
              ))}
            </select>

            <div className="tt-level-tabs" role="group" aria-label="Ownership status filter">
              <button
                type="button"
                className={`tt-tab ${statusFilter === 'all' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`tt-tab ${statusFilter === 'owned' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('owned')}
              >
                Owned
              </button>
              <button
                type="button"
                className={`tt-tab ${statusFilter === 'lost' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('lost')}
              >
                Lost ({lostCount})
              </button>
            </div>
          </div>
        </div>
      </div>

      {filteredCards.length === 0 ? (
        <div className="tt-window tt-empty-state">
          <p>No cards match your current filters.</p>
          <button
            type="button"
            className="tt-btn tt-btn--ghost"
            onClick={() => {
              setSearch('');
              setLevelFilter('all');
              setElemFilter('all');
              setStatusFilter('all');
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="tt-binder-grid">
          {filteredCards.map((card) => {
            const count = profile.collection[card.id] ?? 0;
            const owned = count > 0;
            const lost = isCardLost(card.id);
            const recovery = lost ? getRecoveryInfo(card) : null;

            return (
              <button
                key={card.id}
                type="button"
                className={`tt-binder-tile ${
                  owned ? 'is-owned' : lost ? 'is-lost' : 'is-unowned'
                }`}
                onClick={() => {
                  soundEngine.playCursor();
                  setInspectedCard(card);
                }}
              >
                <div className="tt-binder-card-wrap">
                  <CardView
                    cardId={owned || lost ? card.id : null}
                    owner={owned ? 'player' : 'opponent'}
                    faceDown={!owned && !lost}
                    compact
                  />
                  {lost && <span className="tt-binder-lost-pill">LOST</span>}
                </div>
                <div className="tt-binder-meta">
                  <span className="tt-binder-idx">
                    #{String(card.index).padStart(3, '0')} · Lv{card.level}
                  </span>
                  <strong className="tt-binder-name">
                    {card.isRare ? '★ ' : ''}
                    {card.name}
                  </strong>
                  <span className="tt-binder-count">
                    {owned ? `Owned ×${count}` : lost ? 'Lost' : 'Unowned'}
                  </span>
                  {lost && recovery && (
                    <span className="tt-binder-reclaim" title={recovery.detail}>
                      Reclaim: {recovery.shortLabel}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <MobileSheet
        open={inspectedCard !== null}
        title={inspectedCard ? `#${inspectedCard.index} ${inspectedCard.name}` : ''}
        subtitle={
          inspectedCard
            ? `Level ${inspectedCard.level} ${inspectedCard.category.toUpperCase()} Card`
            : undefined
        }
        onClose={() => setInspectedCard(null)}
      >
        {inspectedCard && inspectedRecovery && (
          <div className="tt-inspector">
            <div className={`tt-inspector-card ${inspectedLost ? 'is-lost' : ''}`}>
              <CardView
                cardId={inspectedCard.id}
                owner={inspectedOwned ? 'player' : 'opponent'}
              />
            </div>
            <div className="tt-inspector-details">
              <div className="tt-pill-row" style={{ marginBottom: 8 }}>
                {inspectedOwned ? (
                  <span className="tt-pill tt-pill--ok">OWNED</span>
                ) : inspectedLost ? (
                  <span className="tt-pill tt-pill--lost">LOST — RECLAIMABLE</span>
                ) : (
                  <span className="tt-pill">UNCOLLECTED</span>
                )}
              </div>

              <p>
                <strong>Ranks:</strong> Top {formatRank(inspectedCard.ranks.top)} · Right{' '}
                {formatRank(inspectedCard.ranks.right)} · Bottom{' '}
                {formatRank(inspectedCard.ranks.bottom)} · Left{' '}
                {formatRank(inspectedCard.ranks.left)}
              </p>
              <p>
                <strong>Element:</strong>{' '}
                {inspectedCard.element === 'none'
                  ? 'None'
                  : inspectedCard.element.toUpperCase()}
              </p>
              <p>
                <strong>Card Mod:</strong> {inspectedCard.cardMod}
              </p>
              <p>
                <strong>Owned Copies:</strong>{' '}
                {profile.collection[inspectedCard.id] ?? 0}
                {CARDS_BY_ID[inspectedCard.id]?.isRare ? ' (Unique Rare — max 1)' : ''}
              </p>

              <p
                className={`tt-notice ${
                  inspectedLost ? 'tt-notice--gold' : 'tt-notice--info'
                }`}
              >
                {inspectedRecovery.detail}
              </p>

              {!inspectedOwned &&
                onJumpToRegion &&
                inspectedRecovery.targetRegionId && (
                  <button
                    type="button"
                    className="tt-btn tt-btn--gold tt-btn--sm"
                    style={{ marginTop: 10 }}
                    onClick={() => {
                      const target = inspectedRecovery.targetRegionId!;
                      soundEngine.playConfirm();
                      setInspectedCard(null);
                      onJumpToRegion(target);
                    }}
                  >
                    <MapPin size={14} />
                    Go to {REGIONS[inspectedRecovery.targetRegionId].name} in World Tour
                  </button>
                )}
            </div>
          </div>
        )}
      </MobileSheet>
    </div>
  );
};
