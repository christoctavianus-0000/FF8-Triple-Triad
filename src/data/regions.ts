import type { RegionDefinition, RegionId, SpecialRule, TradeRule } from '../types/tripleTriad';

export const REGION_ORDER: readonly RegionId[] = [
  'balamb',
  'galbadia',
  'dollet',
  'fh',
  'trabia',
  'centra',
  'esthar',
  'lunar',
];

export const REGIONS: Readonly<Record<RegionId, RegionDefinition>> = {
  balamb: {
    id: 'balamb',
    name: 'Balamb',
    subtitle: 'Balamb Garden & Harbor Town',
    defaultRules: ['open'],
    defaultTradeRule: 'one',
    accentColor: '#4c88e0',
    description:
      'Birthplace of the SeeD card craze. Clean Open matches, home to the secret Card Club (CC Group), and the harbor student who wipes Balamb rules clean.',
  },
  galbadia: {
    id: 'galbadia',
    name: 'Galbadia',
    subtitle: 'Timber, Deling City & G-Garden',
    defaultRules: ['same'],
    defaultTradeRule: 'one',
    accentColor: '#d05858',
    description:
      'Industrial military power where Same rewards matching edge ranks across friendly and opposing cards alike.',
  },
  dollet: {
    id: 'dollet',
    name: 'Dollet',
    subtitle: 'Dukedom Pub & Seaside Square',
    defaultRules: ['random', 'elemental'],
    defaultTradeRule: 'one',
    accentColor: '#c9a34a',
    description:
      'Starting haunt of the Queen of Cards. Random tests collection depth while Elemental tiles shift card ranks by ±1.',
  },
  fh: {
    id: 'fh',
    name: "Fisherman's Horizon",
    subtitle: 'Horizon Bridge & Dockyard',
    defaultRules: ['elemental', 'suddenDeath'],
    defaultTradeRule: 'one',
    accentColor: '#48a89d',
    description:
      'Peaceful ocean railway town where Sudden Death forces immediate rematches on 5–5 draws with captured colors intact.',
  },
  trabia: {
    id: 'trabia',
    name: 'Trabia',
    subtitle: 'Snowy Garden & Shumi Village',
    defaultRules: ['random', 'plus'],
    defaultTradeRule: 'one',
    accentColor: '#76b5e8',
    description:
      'Northern wastes ruled by Random and Plus — one equal-sum placement can trigger devastating multi-card Combos.',
  },
  centra: {
    id: 'centra',
    name: 'Centra',
    subtitle: "Winhill, Edea's House & Chocobo Forest",
    defaultRules: ['same', 'plus', 'random'],
    defaultTradeRule: 'one',
    accentColor: '#9c7ae0',
    description:
      'Ruined continent combining Same, Plus, and Random. Careful corner control is vital against Centra veterans.',
  },
  esthar: {
    id: 'esthar',
    name: 'Esthar',
    subtitle: 'High-Tech Metropolis & Odine Lab',
    defaultRules: ['elemental', 'sameWall'],
    defaultTradeRule: 'one',
    accentColor: '#56c4d8',
    description:
      'Advanced city carrying Elemental and latent Same Wall — inert until paired with Same, yet spreadable abroad.',
  },
  lunar: {
    id: 'lunar',
    name: 'Lunar',
    subtitle: 'Lunar Gate & Orbiting Base',
    defaultRules: ['open', 'same', 'plus', 'elemental', 'sameWall', 'random', 'suddenDeath'],
    defaultTradeRule: 'one',
    accentColor: '#e08956',
    description:
      'All seven special rules active at once. Mastering Lunar is the ultimate Triple Triad gauntlet.',
  },
};

export const SPECIAL_RULE_INFO: Readonly<
  Record<SpecialRule, { label: string; shortDesc: string; detail: string }>
> = {
  open: {
    label: 'Open',
    shortDesc: 'Opponent hand is face-up',
    detail: 'All five cards in the opponent’s hand remain visible throughout the match.',
  },
  same: {
    label: 'Same',
    shortDesc: '2+ matching touching ranks capture',
    detail:
      'If a placed card matches the touching printed rank of 2+ adjacent cards (at least 1 opposing), matching enemy cards flip and trigger Combo.',
  },
  sameWall: {
    label: 'Same Wall',
    shortDesc: 'Board walls count as rank A for Same',
    detail:
      'Only active alongside Same. Board outer edges count as rank A (10) when checking Same matches, and are hidden in previews if Same is off.',
  },
  plus: {
    label: 'Plus',
    shortDesc: '2+ equal touching rank sums capture',
    detail:
      'If 2+ adjacent sides share an identical sum of touching printed ranks (at least 1 opposing), those opposing cards flip and trigger Combo.',
  },
  elemental: {
    label: 'Elemental',
    shortDesc: 'Tile element gives ±1 rank modifier',
    detail:
      'Matching a tile’s element grants +1 to all ranks (up to 11); mismatching (including non-elemental cards) gives -1 (down to 0). Same/Plus still use printed ranks.',
  },
  random: {
    label: 'Random',
    shortDesc: '5 cards chosen at random',
    detail: 'Five cards are drawn automatically from your collection instead of manual selection.',
  },
  suddenDeath: {
    label: 'Sudden Death',
    shortDesc: '5–5 draws replay with colored hands',
    detail:
      'On a 5–5 tie, a new round starts immediately where each player keeps the cards bearing their color at the end of the round.',
  },
};

export const TRADE_RULE_INFO: Readonly<
  Record<TradeRule, { label: string; rank: number; shortDesc: string }>
> = {
  one: {
    label: 'One',
    rank: 1,
    shortDesc: 'Winner selects 1 card from the loser’s hand.',
  },
  diff: {
    label: 'Diff',
    rank: 2,
    shortDesc: 'Winner selects cards equal to the score margin (max 5).',
  },
  direct: {
    label: 'Direct',
    rank: 3,
    shortDesc: 'Each player keeps all cards matching their color at match end.',
  },
  all: {
    label: 'All',
    rank: 4,
    shortDesc: 'Winner claims all 5 cards from the loser’s hand.',
  },
};
