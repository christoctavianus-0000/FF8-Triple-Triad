import React, { useMemo, useState } from 'react';
import { Shuffle, Sparkles, Swords } from 'lucide-react';
import { ALL_CARDS, CARDS_BY_ID } from '../data/cards';
import { SPECIAL_RULE_INFO, TRADE_RULE_INFO } from '../data/regions';
import { buildRandomHand } from '../engine/engine';
import { getVisibleRules } from '../engine/regionalRules';
import { formatRank } from '../engine/rules';
import { soundEngine } from '../audio/soundEngine';
import type { AiTier, SpecialRule, TradeRule } from '../types/tripleTriad';
import { CardView } from './CardView';
import { Ff8Cursor } from './Ff8Cursor';

interface HandSelectModalProps {
  opponentName: string;
  opponentTitle: string;
  aiTier: AiTier;
  rules: SpecialRule[];
  tradeRule: TradeRule;
  collection: Record<string, number>;
  initialHand: string[];
  sandboxMode: boolean;
  onStartMatch: (hand: string[]) => void;
  onCancel: () => void;
}

export const HandSelectModal: React.FC<HandSelectModalProps> = ({
  opponentName,
  opponentTitle,
  aiTier,
  rules,
  tradeRule,
  collection,
  initialHand,
  sandboxMode,
  onStartMatch,
  onCancel,
}) => {
  const isRandom = rules.includes('random');
  const visibleRules = useMemo(() => getVisibleRules(rules), [rules]);

  const [selectedHand, setSelectedHand] = useState<string[]>(() => {
    if (isRandom) {
      return buildRandomHand(collection);
    }
    const valid: string[] = [];
    const usedCounts: Record<string, number> = {};
    for (const id of initialHand) {
      const avail = collection[id] ?? 0;
      const used = usedCounts[id] ?? 0;
      if (avail > used && valid.length < 5) {
        valid.push(id);
        usedCounts[id] = used + 1;
      }
    }
    if (valid.length === 5) return valid;
    // Auto-fill strongest available
    const pool = ALL_CARDS.filter((c) => (collection[c.id] ?? 0) > 0).sort(
      (a, b) =>
        b.level - a.level ||
        b.ranks.top + b.ranks.right + b.ranks.bottom + b.ranks.left -
          (a.ranks.top + a.ranks.right + a.ranks.bottom + a.ranks.left),
    );
    for (const c of pool) {
      const avail = collection[c.id] ?? 0;
      while ((usedCounts[c.id] ?? 0) < avail && valid.length < 5) {
        valid.push(c.id);
        usedCounts[c.id] = (usedCounts[c.id] ?? 0) + 1;
      }
      if (valid.length === 5) break;
    }
    return valid;
  });

  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'level-desc' | 'index-asc' | 'name-asc'>('level-desc');

  const usedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of selectedHand) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }, [selectedHand]);

  const ownedCards = useMemo(() => {
    const filtered = ALL_CARDS.filter((c) => {
      if ((collection[c.id] ?? 0) <= 0) return false;
      if (levelFilter !== 'all' && c.level !== levelFilter) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'level-desc') {
        const sumA = a.ranks.top + a.ranks.right + a.ranks.bottom + a.ranks.left;
        const sumB = b.ranks.top + b.ranks.right + b.ranks.bottom + b.ranks.left;
        return b.level - a.level || sumB - sumA || a.index - b.index;
      }
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      return a.index - b.index;
    });
  }, [collection, levelFilter, sortBy]);

  const handleAddCard = (cardId: string) => {
    if (isRandom || selectedHand.length >= 5) return;
    const avail = collection[cardId] ?? 0;
    const used = usedCounts[cardId] ?? 0;
    if (used >= avail) return;
    soundEngine.playCursor();
    setSelectedHand((prev) => [...prev, cardId]);
  };

  const handleRemoveSlot = (idx: number) => {
    if (isRandom) return;
    soundEngine.playCancel();
    setSelectedHand((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAutoStrongest = () => {
    if (isRandom) return;
    soundEngine.playConfirm();
    const sorted = [...ALL_CARDS]
      .filter((c) => (collection[c.id] ?? 0) > 0)
      .sort((a, b) => {
        const sumA = a.ranks.top + a.ranks.right + a.ranks.bottom + a.ranks.left;
        const sumB = b.ranks.top + b.ranks.right + b.ranks.bottom + b.ranks.left;
        return b.level - a.level || sumB - sumA;
      });
    const next: string[] = [];
    const used: Record<string, number> = {};
    for (const c of sorted) {
      const avail = collection[c.id] ?? 0;
      while ((used[c.id] ?? 0) < avail && next.length < 5) {
        next.push(c.id);
        used[c.id] = (used[c.id] ?? 0) + 1;
      }
      if (next.length === 5) break;
    }
    setSelectedHand(next);
  };

  return (
    <div className="tt-hand-select">
      <div className="tt-window tt-prematch-banner">
        <div className="tt-prematch-opponent">
          <div>
            <span className="tt-label">CHALLENGER</span>
            <h2>{opponentName}</h2>
            <p className="tt-muted">{opponentTitle} · AI: {aiTier.toUpperCase()}</p>
          </div>
          {sandboxMode && <span className="tt-pill tt-pill--gold">Sandbox Active</span>}
        </div>
        <div className="tt-prematch-rules">
          <div>
            <span className="tt-label">SPECIAL RULES</span>
            <div className="tt-pill-row">
              {visibleRules.length === 0 ? (
                <span className="tt-pill">None (Pure Classic)</span>
              ) : (
                visibleRules.map((r) => (
                  <span key={r} className="tt-pill tt-pill--rule" title={SPECIAL_RULE_INFO[r].detail}>
                    {SPECIAL_RULE_INFO[r].label}
                  </span>
                ))
              )}
            </div>
          </div>
          <div>
            <span className="tt-label">TRADE RULE</span>
            <span className="tt-pill tt-pill--trade" title={TRADE_RULE_INFO[tradeRule].shortDesc}>
              {TRADE_RULE_INFO[tradeRule].label}
            </span>
          </div>
        </div>
      </div>

      <div className="tt-window tt-selected-deck-panel">
        <div className="tt-panel-head">
          <h3>
            {isRandom ? 'Random Rule: 5 Cards Drawn' : `Your 5-Card Hand (${selectedHand.length}/5)`}
          </h3>
          {!isRandom && (
            <div className="tt-btn-row">
              <button type="button" className="tt-btn tt-btn--ghost" onClick={handleAutoStrongest}>
                <Sparkles size={15} /> Auto-Best
              </button>
              <button
                type="button"
                className="tt-btn tt-btn--ghost"
                onClick={() => {
                  soundEngine.playCardDeal();
                  setSelectedHand(buildRandomHand(collection));
                }}
              >
                <Shuffle size={15} /> Randomize
              </button>
              <button
                type="button"
                className="tt-btn tt-btn--ghost"
                onClick={() => {
                  soundEngine.playCancel();
                  setSelectedHand([]);
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="tt-selected-slots">
          {Array.from({ length: 5 }, (_, idx) => {
            const cid = selectedHand[idx] ?? null;
            return (
              <div key={idx} className="tt-selected-slot">
                {cid ? (
                  <CardView
                    cardId={cid}
                    owner="player"
                    compact
                    onClick={isRandom ? undefined : () => handleRemoveSlot(idx)}
                    ariaLabel={
                      isRandom
                        ? CARDS_BY_ID[cid]?.name
                        : `Remove ${CARDS_BY_ID[cid]?.name} from hand`
                    }
                  />
                ) : (
                  <div className="tt-empty-slot">Slot {idx + 1}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!isRandom && (
        <div className="tt-window tt-deck-picker">
          <div className="tt-picker-controls">
            <div className="tt-level-tabs" role="tablist" aria-label="Filter by card level">
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
            <select
              aria-label="Sort cards"
              className="tt-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="level-desc">Sort: Strongest</option>
              <option value="index-asc">Sort: Card #</option>
              <option value="name-asc">Sort: Name</option>
            </select>
          </div>

          <div className="tt-picker-grid">
            {ownedCards.map((card) => {
              const avail = collection[card.id] ?? 0;
              const used = usedCounts[card.id] ?? 0;
              const remaining = avail - used;
              const canPick = remaining > 0 && selectedHand.length < 5;
              return (
                <button
                  key={card.id}
                  type="button"
                  disabled={!canPick}
                  className={`tt-picker-row ${!canPick ? 'is-exhausted' : ''}`}
                  onClick={() => handleAddCard(card.id)}
                >
                  <span className="tt-picker-lvl">L{card.level}</span>
                  <span className="tt-picker-name">
                    {card.isRare ? '★ ' : ''}
                    {card.name}
                  </span>
                  <span className="tt-picker-ranks">
                    {formatRank(card.ranks.top)}/{formatRank(card.ranks.right)}/
                    {formatRank(card.ranks.bottom)}/{formatRank(card.ranks.left)}
                  </span>
                  <span className="tt-picker-count">×{remaining}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="tt-prematch-actions">
        <button
          type="button"
          className="tt-btn tt-btn--ghost"
          onClick={() => {
            soundEngine.playCancel();
            onCancel();
          }}
        >
          Back
        </button>
        <button
          type="button"
          className="tt-btn tt-btn--primary"
          disabled={selectedHand.length !== 5}
          onClick={() => {
            soundEngine.playConfirm();
            onStartMatch(selectedHand);
          }}
        >
          <Ff8Cursor size={16} />
          <Swords size={16} />
          Begin Duel
        </button>
      </div>
    </div>
  );
};
