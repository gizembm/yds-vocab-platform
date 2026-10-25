// The only browser global. Classic scripts also work when index.html is opened via file://.
(() => {
  'use strict';

  globalThis.Vocab = {
    config: {
      STORAGE_KEY: 'flashcards_v1',
      DAY: 864e5,
      LEITNER_INTERVALS: [0, 0, 1, 3, 7, 14],
      // Virtual category made of the words with the highest mistake score.
      HARD_SCOPE: '__hard__',
      HARD_MIN_SCORE: 2,
      HARD_LIMIT: 40
    },
    utils: {},
    store: {},
    session: {},
    importer: {},
    decks: {},
    study: {},
    navigation: {},
    matching: {},
    quiz: {},
    sentence: {},
    daily: {},
    audio: {},
    shortcuts: {},
    words: {},
    backup: {},
    progress: {}
  };
})();
