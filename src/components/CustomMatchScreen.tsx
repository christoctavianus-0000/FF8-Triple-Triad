import React, { useState } from 'react';
import { Sliders, Sparkles, Swords } from 'lucide-react';
import { SPECIAL_RULE_INFO, TRADE_RULE_INFO } from '../data/regions';
import { soundEngine } from '../audio/soundEngine';
import type { AiTier, SpecialRule, TradeRule } from '../types/tripleTriad';
import { Ff8Cursor } from './Ff8Cursor';

const ALL_SPECIAL_RULES: readonly SpecialRule[] = [
  'open',
  'same',
  'sameWall',
  'plus',
  'elemental',
  'random',
  'suddenDeath',
];

const ALL_TRADE_RULES: readonly TradeRule[] = ['one', 'diff', 'direct', 'all'];

interface CustomMatchScreenProps {
  sandboxMode: boolean;
  onToggleSandbox: (enabled: boolean) => void;
  onLaunchCustomMatch: (config: {
    aiTier: AiTier;
    deckLevels: number[];
    rules: SpecialRule[];
    tradeRule: TradeRule;
    sandbox: boolean;
  }) => void;
}

export const CustomMatchScreen: React.FC<CustomMatchScreenProps> = ({
  sandboxMode,
  onToggleSandbox,
  onLaunchCustomMatch,
}) => {
  const [aiTier, setAiTier] = useState<AiTier>('standard');
  const [deckPreset, setDeckPreset] = useState<'low' | 'mid' | 'high' | 'all'>('mid');
  const [rules, setRules] = useState<SpecialRule[]>(['open', 'plus', 'elemental']);
  const [tradeRule, setTradeRule] = useState<TradeRule>('one');

  const toggleRule = (rule: SpecialRule) => {
    soundEngine.playCursor();
    setRules((prev) =>
      prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule],
    );
  };

  const deckLevels =
    deckPreset === 'low'
      ? [1, 2, 3]
      : deckPreset === 'mid'
        ? [3, 4, 5, 6]
        : deckPreset === 'high'
          ? [5, 6, 7]
          : [1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="tt-custom">
      <div className="tt-window tt-custom-panel">
        <div className="tt-panel-head">
          <h2>
            <Sliders size={18} /> Custom Skirmish &amp; Sandbox
          </h2>
          <button
            type="button"
            className={`tt-btn ${sandboxMode ? 'tt-btn--gold' : 'tt-btn--ghost'}`}
            onClick={() => {
              soundEngine.playConfirm();
              onToggleSandbox(!sandboxMode);
            }}
          >
            <Sparkles size={15} />
            {sandboxMode ? 'Sandbox: All 110 Cards Unlocked' : 'Enable Sandbox (All 110 Cards)'}
          </button>
        </div>

        <p className="tt-muted">
          Configure any combination of FF8 rules, AI intelligence, and opponent deck strength.
          {sandboxMode
            ? ' Sandbox matches never modify your campaign collection.'
            : ' Campaign trade rules apply unless Sandbox Mode is enabled.'}
        </p>

        <div className="tt-custom-grid">
          <div className="tt-custom-group">
            <span className="tt-label">OPPONENT AI TIER</span>
            <div className="tt-segmented">
              {(['novice', 'standard', 'master'] as AiTier[]).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  className={`tt-seg-btn ${aiTier === tier ? 'is-active' : ''}`}
                  onClick={() => {
                    soundEngine.playCursor();
                    setAiTier(tier);
                  }}
                >
                  {tier.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="tt-custom-group">
            <span className="tt-label">OPPONENT DECK STRENGTH</span>
            <div className="tt-segmented">
              {[
                { id: 'low', label: 'Lv 1–3' },
                { id: 'mid', label: 'Lv 3–6' },
                { id: 'high', label: 'Lv 5–7' },
                { id: 'all', label: 'Lv 1–7' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`tt-seg-btn ${deckPreset === opt.id ? 'is-active' : ''}`}
                  onClick={() => {
                    soundEngine.playCursor();
                    setDeckPreset(opt.id as typeof deckPreset);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="tt-custom-group">
          <div className="tt-panel-head">
            <span className="tt-label">SPECIAL RULES</span>
            <div className="tt-btn-row">
              <button
                type="button"
                className="tt-btn tt-btn--ghost tt-btn--sm"
                onClick={() => setRules(['open'])}
              >
                Balamb Preset
              </button>
              <button
                type="button"
                className="tt-btn tt-btn--ghost tt-btn--sm"
                onClick={() => setRules([...ALL_SPECIAL_RULES])}
              >
                All 7 Rules (Lunar)
              </button>
              <button
                type="button"
                className="tt-btn tt-btn--ghost tt-btn--sm"
                onClick={() => setRules([])}
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="tt-rule-toggle-grid">
            {ALL_SPECIAL_RULES.map((rule) => {
              const active = rules.includes(rule);
              return (
                <button
                  key={rule}
                  type="button"
                  className={`tt-rule-toggle ${active ? 'is-active' : ''}`}
                  onClick={() => toggleRule(rule)}
                >
                  <strong>{SPECIAL_RULE_INFO[rule].label}</strong>
                  <span>{SPECIAL_RULE_INFO[rule].shortDesc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="tt-custom-group">
          <span className="tt-label">TRADE RULE</span>
          <div className="tt-rule-toggle-grid">
            {ALL_TRADE_RULES.map((tr) => (
              <button
                key={tr}
                type="button"
                className={`tt-rule-toggle ${tradeRule === tr ? 'is-active' : ''}`}
                onClick={() => {
                  soundEngine.playCursor();
                  setTradeRule(tr);
                }}
              >
                <strong>{TRADE_RULE_INFO[tr].label}</strong>
                <span>{TRADE_RULE_INFO[tr].shortDesc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="tt-prematch-actions">
          <button
            type="button"
            className="tt-btn tt-btn--primary"
            onClick={() => {
              soundEngine.playConfirm();
              onLaunchCustomMatch({
                aiTier,
                deckLevels,
                rules,
                tradeRule,
                sandbox: sandboxMode,
              });
            }}
          >
            <Ff8Cursor size={16} />
            <Swords size={16} />
            Start Custom Match
          </button>
        </div>
      </div>
    </div>
  );
};
