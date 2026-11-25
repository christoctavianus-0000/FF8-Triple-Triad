import React, { useState } from 'react';
import { CARDS_BY_ID } from '../data/cards';
import { formatRank } from '../engine/rules';
import type { Owner } from '../types/tripleTriad';

interface CardViewProps {
  cardId: string | null;
  owner: Owner;
  faceDown?: boolean;
  selected?: boolean;
  justFlipped?: boolean;
  elementalMod?: -1 | 0 | 1;
  compact?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onMouseEnter?: () => void;
  ariaLabel?: string;
}

export const CardView: React.FC<CardViewProps> = ({
  cardId,
  owner,
  faceDown = false,
  selected = false,
  justFlipped = false,
  elementalMod = 0,
  compact = false,
  disabled = false,
  onClick,
  onPointerDown,
  onMouseEnter,
  ariaLabel,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const card = cardId ? CARDS_BY_ID[cardId] : null;

  const ownerClass = owner === 'player' ? 'tt-card--player' : 'tt-card--opponent';
  const stateClasses = [
    'tt-card',
    ownerClass,
    faceDown ? 'tt-card--facedown' : '',
    selected ? 'tt-card--selected' : '',
    justFlipped ? 'tt-card--flipped' : '',
    compact ? 'tt-card--compact' : '',
    disabled ? 'tt-card--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (faceDown || !card) {
    return (
      <button
        type="button"
        className={stateClasses}
        disabled={disabled || !onClick}
        onClick={onClick}
        aria-label={ariaLabel ?? 'Hidden Triple Triad card'}
      >
        <div className="tt-card-back">
          <div className="tt-card-back-inner">
            <span className="tt-card-back-crest">TT</span>
            <span className="tt-card-back-sub">FFVIII</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={stateClasses}
      disabled={disabled && !onClick}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onMouseEnter={onMouseEnter}
      aria-label={
        ariaLabel ??
        `${card.name}, Level ${card.level}, Ranks ${formatRank(card.ranks.top)}/${formatRank(card.ranks.right)}/${formatRank(card.ranks.bottom)}/${formatRank(card.ranks.left)}`
      }
      title={`${card.name} (Lv${card.level})`}
    >
      <div className="tt-card-frame">
        {!imgFailed ? (
          <img
            src={card.imagePath}
            alt={card.name}
            className="tt-card-art"
            draggable={false}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="tt-card-fallback">
            <div className="tt-card-fallback-ranks">
              <span className="r-top">{formatRank(card.ranks.top)}</span>
              <span className="r-left">{formatRank(card.ranks.left)}</span>
              <span className="r-right">{formatRank(card.ranks.right)}</span>
              <span className="r-bot">{formatRank(card.ranks.bottom)}</span>
            </div>
            <span className="tt-card-fallback-name">{card.name}</span>
          </div>
        )}

        {/* Ownership tint layer: keeps monster/character art legible while clearly distinguishing Red vs Blue */}
        <div className="tt-card-owner-tint" aria-hidden="true" />

        {card.isRare && (
          <span className="tt-card-rare-star" title={`Rare Level ${card.level} Card`}>
            ★
          </span>
        )}

        {elementalMod !== 0 && (
          <span
            className={`tt-card-elem-mod ${elementalMod > 0 ? 'is-buff' : 'is-debuff'}`}
            title={elementalMod > 0 ? 'Elemental Match (+1 all ranks)' : 'Elemental Mismatch (-1 all ranks)'}
          >
            {elementalMod > 0 ? '+1' : '-1'}
          </span>
        )}

        <span className="tt-card-name-tag">{card.name}</span>
      </div>
    </button>
  );
};
