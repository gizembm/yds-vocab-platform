// Entry point: bind UI events only after all feature definitions have loaded.
(() => {
  'use strict';

  const app = globalThis.Vocab;
  const { $ } = app.utils;

  $('file').onchange = event => {
    if (event.target.files[0]) app.importer.parseFile(event.target.files[0]);
    event.target.value = '';
  };
  $('addDeck').onclick = app.decks.addDeck;
  $('card').onclick = app.study.flipCard;
  $('prevCard').onclick = () => app.study.moveCard(-1);
  $('nextCard').onclick = () => app.study.moveCard(1);
  $('rate').onclick = app.study.rateStudy;
  $('all').onclick = app.study.showAllCards;
  $('back').onclick = app.navigation.showHome;
  $('playBack').onclick = app.navigation.showHome;
  $('gameAgain').onclick = () => {
    if (app.session.play.daily) return app.daily.restartDailyGame();
    const { mode, scope } = app.session.play;
    if (mode === 'match') return app.matching.buildMatch();
    if (mode === 'sentence') return app.sentence.startSentence(scope);
    if (mode === 'synonyms' || mode === 'antonyms') return app.quiz.startRelation(scope, mode);
    return app.quiz.startQuiz(scope);
  };
  $('spkW').onclick = event => {
    event.stopPropagation();
    app.audio.speak($('en').textContent);
  };
  $('spkS').onclick = event => {
    event.stopPropagation();
    app.audio.speak($('ex').textContent);
  };
  $('programStart').onclick = app.daily.beginDaily;
  $('programStudy').onclick = app.daily.startDailyStudy;
  $('dailyReturn').onclick = app.navigation.showHome;

  app.decks.renderDecks();
  const lastView = app.store.data.lastView;
  if (lastView?.type === 'study') {
    app.study.startStudy(lastView.scope);
  } else if (lastView?.type === 'play') {
    if (lastView.mode === 'match') app.matching.startMatch(lastView.scope);
    else if (lastView.mode === 'sentence') app.sentence.startSentence(lastView.scope);
    else if (lastView.mode === 'synonyms' || lastView.mode === 'antonyms') app.quiz.startRelation(lastView.scope, lastView.mode);
    else app.quiz.startQuiz(lastView.scope);
  } else if (lastView?.type === 'dailyStudy') {
    app.daily.startDailyStudy();
  } else if (lastView?.type === 'dailyGame') {
    app.daily.startDailyGame(lastView.mode);
  } else if (!lastView) {
    const currentCardId = app.store.data.cur;
    if (currentCardId) {
      const category = Object.keys(app.store.data.decks)
        .find(name => app.store.data.decks[name].some(card => card.id === currentCardId));
      if (category) app.study.startStudy(category);
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', app.daily.refreshDailyDay);
    document.addEventListener('visibilitychange', app.daily.refreshDailyDay);
    setInterval(app.daily.refreshDailyDay, 1000);
  }
})();
