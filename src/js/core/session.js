// Transient UI state. These queues and timer handles are never written to localStorage.
(() => {
  'use strict';

  const session = globalThis.Vocab.session;
  session.study = {
    scope: null, forceAll: false, queue: [], flipped: false, index: 0, daily: false
  };
  session.play = {
    scope: null, mode: '', daily: false,
    match: { pick: [], cards: [], timer: null, seen: new Map() },
    quiz: { list: [], step: 0, timer: null, locked: false }
  };
})();
