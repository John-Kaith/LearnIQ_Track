import type { ImageSourcePropType } from 'react-native';

/**
 * The Arcade games, in the web Arcade's order (frontend/js/pages/arcade.entry.js
 * GAMES). The games themselves are the website's game pages, opened in the
 * app's WebView; the covers are captured from the web Arcade's box art.
 */
export type ArcadeGame = {
  /** Same key as the web Arcade and the saved results (`metadata.game`). */
  id: string;
  name: string;
  /** Game page on the LearnIQ website. */
  page: string;
  /** One-line pitch, as on the web Arcade's game cards. */
  card: string;
  tags: string[];
  cover: ImageSourcePropType;
  /** Colors behind the status bar / home indicator while playing. */
  topColor: string;
  bottomColor: string;
};

export const ARCADE_GAMES: ArcadeGame[] = [
  {
    id: 'word-clash',
    name: 'Word Clash',
    page: 'battle-arena.html',
    card: 'Spell the answer to defeat the monster.',
    tags: ['Spelling', 'Solo', 'All subjects'],
    cover: require('@/assets/images/arcade/word-clash.png'),
    topColor: '#1b1240',
    bottomColor: '#100a26',
  },
  {
    id: 'tic-tac-know',
    name: 'Tic-Tac-Know',
    page: 'tic-tac-know.html',
    card: 'Answer a question to claim a square. Get three in a row to win.',
    tags: ['Multiple choice', 'vs Bot', 'All subjects'],
    cover: require('@/assets/images/arcade/tic-tac-know.png'),
    topColor: '#6b4423',
    bottomColor: '#6b4423',
  },
  {
    id: 'sungka',
    name: 'Sungka',
    page: 'sungka.html',
    card: 'Answer right to pick your bahay. Most shells in your ulo wins.',
    tags: ['Board game', 'vs Bot', 'Larong Pinoy'],
    cover: require('@/assets/images/arcade/sungka.png'),
    topColor: '#7a5a34',
    bottomColor: '#7a5a34',
  },
  {
    id: 'palosebo',
    name: 'Palosebo',
    page: 'palosebo.html',
    card: 'Race up the greasy poles. The faster you answer, the higher you climb.',
    tags: ['Race', 'vs 3 bots', 'Larong Pinoy'],
    cover: require('@/assets/images/arcade/palosebo.png'),
    topColor: '#3b1d4f',
    bottomColor: '#2a1430',
  },
  {
    id: 'patintero',
    name: 'Patintero',
    page: 'patintero.html',
    card: 'Dodge the taya. Tagged? Answer right to slip through.',
    tags: ['Action', 'Solo', 'Larong Pinoy'],
    cover: require('@/assets/images/arcade/patintero.png'),
    topColor: '#0b1020',
    bottomColor: '#1b2350',
  },
  {
    id: 'tumbang-preso',
    name: 'Tumbang Preso',
    page: 'tumbang-preso.html',
    card: 'Answer right to earn a throw. Knock the can down with your tsinelas.',
    tags: ['Aim', 'vs Bot', 'Larong Pinoy'],
    cover: require('@/assets/images/arcade/tumbang-preso.png'),
    topColor: '#3b8de0',
    bottomColor: '#57534e',
  },
  {
    id: 'pinoy-henyo',
    name: 'Pinoy Henyo',
    page: 'pinoy-henyo.html',
    card: 'Ask oo, hindi o pwede and guess the word on your forehead.',
    tags: ['Guess the word', 'Solo', 'Larong Pinoy'],
    cover: require('@/assets/images/arcade/pinoy-henyo.png'),
    topColor: '#7a1020',
    bottomColor: '#1e3a8a',
  },
];

export function findArcadeGame(id: string | null | undefined): ArcadeGame | undefined {
  return ARCADE_GAMES.find((g) => g.id === id);
}

/** Every game page, so the WebView can move between them without closing. */
export const ARCADE_PAGES = ARCADE_GAMES.map((g) => g.page);
// .
