// The only browser global. Classic scripts also work when index.html is opened via file://.
(() => {
  'use strict';

  globalThis.Vocab = {
    config: {
      STORAGE_KEY: 'flashcards_v1',
      DAY: 864e5,
      LEITNER_INTERVALS: [0, 0, 1, 3, 7, 14]
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
    audio: {}
  };
})();
