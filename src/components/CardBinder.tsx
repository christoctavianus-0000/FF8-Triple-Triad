import React, { useMemo, useState } from 'react';
import { Award, Search, X } from 'lucide-react';
import { ALL_CARDS, CARDS_BY_ID } from '../data/cards';
import { NPCS_BY_ID } from '../data/opponents';
import { REGIONS } from '../data/regions';
import { formatRank } from '../engine/rules';
import { soundEngine } from '../audio/soundEngine';
import type { CardDefinition, ElementType, ProfileState } from '../types/tripleTriad';
import { CardView } from './CardView';
import { MobileSheet } from './MobileSheet';

interface CardBinderProps {
  profile: ProfileState;
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

export const CardBinder: React.FC<CardBinderProps> = ({ profile }) => {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all');
  const [elemFilter, setElemFilter] = useState<ElementType | 'all'>('all');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [inspectedCard, setInspectedCard] = useState<CardDefinition | null>(null);

  const uniqueOwned = useMemo(
    () => ALL_CARDS.filter((c) => (profile.collection[c.id] ?? 0) > 0).length,
    [profile.collection],
  );

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_CARDS.filter((card) => {
      if (levelFilter !== 'all' && card.level !== levelFilter) return false;
      if (elemFilter !== 'all' && card.element !== elemFilter) return false;
      if (ownedOnly && (profile.collection[card.id] ?? 0) === 0) return false;
      if (q && !card.name.toLowerCase().includes(q) && !card.cardMod.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [search, levelFilter, elemFilter, ownedOnly, profile.collection]);

  const describeHolder = (card: CardDefinition): string => {
    if (!card.isRare) {
      return `Common Lv${card.level} card — won from regional NPCs using Lv${card.level} decks.`;
    }
    const holder = profile.rareCardHolders[card.id];
    if (holder === 'player' || (profile.collection[card.id] ?? 0) > 0) {
      return 'Held by Squall (In your collection)';
    }
    if (holder === 'unforged') {
      return 'Not yet forged — advance the Queen of Cards quest!';
    }
    if (holder === 'queen') {
      return `Held by Queen of Cards (${REGIONS[profile.queenRegionId].name})`;
    }
    if (holder?.startsWith('npc:')) {
      const npc = NPCS_BY_ID[holder.slice(4)];
      if (npc) {
        const regionName = npc.isQueenOfCards
          ? REGIONS[profile.queenRegionId].name
          : REGIONS[npc.regionId].name;
        return `Held by ${npc.name} in ${regionName} (${npc.location})`;
      }
    }
    return 'Unknown location';
  };

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
              Collect all 110 cards across Levels 1–10 to earn the golden Triple Triad Star.
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

            <button
              type="button"
              className={`tt-btn tt-btn--sm ${ownedOnly ? 'tt-btn--primary' : 'tt-btn--ghost'}`}
              onClick={() => setOwnedOnly((v) => !v)}
            >
              Owned Only
            </button>
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
              setOwnedOnly(false);
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
            return (
              <button
                key={card.id}
                type="button"
                className={`tt-binder-tile ${owned ? 'is-owned' : 'is-unowned'}`}
                onClick={() => {
                  soundEngine.playCursor();
                  setInspectedCard(card);
                }}
              >
                <div className="tt-binder-card-wrap">
                  <CardView
                    cardId={owned ? card.id : null}
                    owner="player"
                    faceDown={!owned}
                    compact
                  />
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
                    {owned ? `Owned ×${count}` : 'Unowned'}
                  </span>
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
        {inspectedCard && (
          <div className="tt-inspector">
            <div className="tt-inspector-card">
              <CardView
                cardId={inspectedCard.id}
                owner={(profile.collection[inspectedCard.id] ?? 0) > 0 ? 'player' : 'opponent'}
              />
            </div>
            <div className="tt-inspector-details">
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
              <p className="tt-notice tt-notice--info">{describeHolder(inspectedCard)}</p>
            </div>
          </div>
        )}
      </MobileSheet>
    </div>
  );
};
