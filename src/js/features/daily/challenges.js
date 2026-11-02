// daily-challenges: a separate daily program per category (10 new words a day). DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, daily } = globalThis.Vocab;
  const session = globalThis.Vocab.session;

  const challengeOf = deck => store.data.challenges?.[deck] || null;

  // Learned words keep their progress: their states move out of the main program.
  // Words that are not learned yet start over as new words of the challenge.
  function startChallenge(deck) {
    const cards = store.data.decks[deck] || [];
    if (!cards.length || challengeOf(deck))return false;
    const main = store.data.program, cardStates = {};
    for (const card of cards) {
      if (!main?.cards[card.id])continue;
      if (main.cards[card.id].learned)cardStates[card.id] = main.cards[card.id];
      delete main.cards[card.id];
    }
    store.data.challenges ||= {};
    store.data.challenges[deck] = {
      version : 1, deck, start : daily.programDate(), dayIndex : 0, cards : cardStates, session : null
    };
    // Today's main session drops the words that now belong to the challenge.
    if (main)daily.ensureDaily(main);
    daily.openChallenge(deck);
    return true;
  }

  function openChallenge(deck) {
    if (!challengeOf(deck))return;
    session.daily.deck = deck;
    store.touchDeck(deck);
    daily.startDailyStudy();
  }

  // The words return to the main program with their progress; they join its next session.
  function leaveChallenge(deck) {
    const p = challengeOf(deck);
    if (!p)return;
    store.data.program ||= { version : 1, start : daily.programDate(), cards : {}, session : null };
    Object.assign(store.data.program.cards, p.cards);
    delete store.data.challenges[deck];
    if (session.daily.deck === deck)session.daily.deck = null;
    store.save();
  }

  function removeChallenge(deck) {
    if (store.data.challenges)delete store.data.challenges[deck];
    if (session.daily.deck === deck)session.daily.deck = null;
  }

  function isComplete(deck) {
    const p = challengeOf(deck), cards = store.data.decks[deck] || [];
    const last = daily.REVIEW_DAYS.length - 1;
    return !!p && cards.length > 0 && cards.every(c => p.cards[c.id]?.learned && p.cards[c.id].stage === last);
  }

  function challengeSummary(deck) {
    const p = challengeOf(deck);
    if (!p)return null;
    const s = daily.ensureDaily(p);
    return (daily.cycleOf(p) + 1) + '. hafta, ' + ((p.dayIndex || 0)%7 + 1) + '. gün · ' +
      s.newIds.length + ' yeni · ' + (s.ids.length - s.newIds.length) + ' tekrar';
  }

  Object.assign(daily, {
    startChallenge,
    openChallenge,
    leaveChallenge,
    removeChallenge,
    isComplete,
    challengeSummary
  });
})();
