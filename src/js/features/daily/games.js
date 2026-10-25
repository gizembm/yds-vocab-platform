// daily-games: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, decks, navigation, matching, sentence, daily } = globalThis.Vocab;
  const { $, shuffle } = globalThis.Vocab.utils;

  const { study: studyState, play: playState } = globalThis.Vocab.session;

  function startDailyGame(mode) {
    if (!daily.GAME_MODES.includes(mode))return;
    if (daily.refreshDailyDay())return;
    const s = daily.ensureDaily();
    if (s.pending.length || !daily.gameAvailable(mode))return;
    const ids = daily.gameIds(mode);
    navigation.showPlay(mode, null);
    playState.daily = true;
    store.data.lastView = { type: 'dailyGame', mode };
    store.save();
    studyState.daily = false;
    const game = s[mode];
    if (game.pending === null)game.pending = shuffle([...ids]);
    store.save();
    $('gameAgain').textContent = 'Turu yeniden başlat';
    document.getElementById('playTitle').textContent = mode === 'sentence' ? 'G\u00fcnl\u00fck C\u00fcmle Tamamla' : mode === 'quiz' ? 'G\u00fcnl\u00fck test' : mode === 'match' ? 'G\u00fcnl\u00fck e\u015fle\u015ftirme' : mode === 'synonyms' ? 'G\u00fcnl\u00fck E\u015f Anlam Bul' : 'G\u00fcnl\u00fck Z\u0131t Anlam Bul';
    if (mode === 'sentence')sentence.showSentence();
    else if (mode !== 'match')daily.dailyShowQuiz();
    else daily.dailyBuildMatch();
  }

  function dailyGameStatus() {
    const s = store.data.program.session, game = s[playState.mode];
    const total = game.done.length + game.pending.length;
    if ($('nextDailyDay'))$('nextDailyDay').hidden = !daily.gamesComplete(s);
    $('playInfo').textContent = 'Günlük çalışma · ' + game.done.length + ' / ' + total + ' tamamlandı';
    $('playHint').textContent = game.pending.length
    ? (playState.mode === 'sentence' ? 'Boşluğu dört seçenekten doğru İngilizce kelimeyle tamamla. ' : 'Bugünün yeni kelimeleri ve zorlandıkların. ') + 'Yanlışlar kart çalışmasına da geri döner.'
    : 'Tur tamamlandı!' + (s.pending.length ? ' Yanlış yaptığın kelimeleri kartlarda yeniden çalış.' : ' Diğer oyuna ana ekrandan geçebilirsin.');
  }

  function restartDailyGame() {
    if (daily.refreshDailyDay())return;
    clearTimeout(playState.quiz.timer);
    playState.quiz.timer = null;
    clearTimeout(playState.match.timer);
    playState.match.timer = null;
    const s = store.data.program.session;
    const ids = daily.gameIds(playState.mode);
    s[playState.mode] = {
      pending : shuffle([...ids]), done : []
    };
    store.save();
    if (playState.mode === 'sentence')sentence.showSentence();
    else if (playState.mode !== 'match')daily.dailyShowQuiz();
    else daily.dailyBuildMatch();
  }

  function dailyShowQuiz() {
    daily.dailyGameStatus();
    const s = store.data.program.session, game = s[playState.mode];
    const c = daily.dailyCards().find(c => c.id === game.pending[0]), choices = $('quizChoices');
    choices.innerHTML = '';
    playState.quiz.locked = false;
    $('quizFeedback').textContent = '';
    $('quizFeedback').className = 'feedback';
    $('quizWord').textContent = c ? c.en : '';
    $('quizExample').textContent = c ? c.ex || '' : '';
    $('quizCat').textContent = c ? store.cardCat(c) : '';
    if (!c)return;
    const relation = ['synonyms', 'antonyms'].includes(playState.mode);
    const terms = card => relation ? daily.relationTerms(card, playState.mode) : [card.tr];
    const correct = terms(c), answer = correct[0];
    const wrong = shuffle([...new Set(daily.dailyCards().filter(x => x.id !== c.id).flatMap(terms))].filter(value => !correct.includes(value))).slice(0, 3);
    shuffle([answer, ...wrong]).forEach(opt => {
      const button = document.createElement('button');
      button.textContent = opt;
      button.onclick = () => daily.dailyAnswerQuiz(button, correct.includes(opt), c, answer);
      choices.append(button);
    });
  }

  function dailyAnswerQuiz(button, ok, c, answer = c.tr) {
    if (daily.refreshDailyDay() || playState.quiz.locked)return;
    playState.quiz.locked = true;
    const game = store.data.program.session[playState.mode], id = game.pending.shift();
    if (ok) {
      game.done.push(id);
      c.quizCorrect = (c.quizCorrect || 0) + 1;
      c.quizDifficulty = Math.max(0, (c.quizDifficulty || 0) - 1);
      store.data.pts += 5;
    }
    else {
      game.pending.splice(Math.min(2, game.pending.length), 0, id);
      daily.dailyMistake(id);
      c.quizDifficulty = Math.min(8, (c.quizDifficulty || 0) + 2);
    }
    button.classList.add(ok ? 'good' : 'bad');
    $('quizFeedback').textContent = ok ? 'Doğru!' : 'Doğru cevap: ' + answer;
    $('quizFeedback').className = 'feedback ' + (ok ? 'good' : 'bad');
    [...$('quizChoices').children].forEach(b => {
      if (b.textContent === answer)b.classList.add('good');
    });
    store.save();
    decks.renderStats();
    playState.quiz.timer = setTimeout(() => {
      playState.quiz.timer = null;
      if (!daily.refreshDailyDay())daily.dailyShowQuiz();
    }, 1000);
  }

  function dailyBuildMatch() {
    clearTimeout(playState.match.timer);
    playState.match.timer = null;
    playState.match.pick = [];
    daily.dailyGameStatus();
    const board = $('matchBoard');
    board.innerHTML = '';
    const game = store.data.program.session.match, cards = daily.dailyCards();
    playState.match.cards = game.pending.slice(0, 6).map(id => cards.find(c => c.id === id)).filter(Boolean);
    if (!playState.match.cards.length)return;
    // A final single word remains playable inside a deck that started with >=2 cards.
    ['en', 'tr'].forEach(type => {
      const column = document.createElement('div');
      column.className = 'match-column';
      const heading = document.createElement('h3');
      heading.textContent = type === 'en' ? 'İngilizce' : 'Türkçe';
      column.append(heading);
      (type === 'en' ? playState.match.cards : shuffle(playState.match.cards)).forEach(c => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.type = type;
        button.lang = type;
        matching.setMatchTile(button, c);
        button.onclick = () => daily.dailyPickMatch(button);
        column.append(button);
      });
      board.append(column);
    });
  }

  function dailyPickMatch(button) {
    if (daily.refreshDailyDay() || playState.match.timer !== null || playState.match.pick.includes(button))return;
    if (playState.match.pick.length && playState.match.pick[0].dataset.type === button.dataset.type) {
      playState.match.pick[0].classList.remove('active');
      playState.match.pick[0].setAttribute('aria-pressed', 'false');
      playState.match.pick = [];
    }
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    playState.match.pick.push(button);
    if (playState.match.pick.length < 2)return;
    const en = playState.match.pick.find(b => b.dataset.type === 'en'), tr = playState.match.pick.find(b => b.dataset.type === 'tr');
    const card = playState.match.cards.find(c => c.id === en.dataset.id), ok = card.tr === tr.textContent;
    const game = store.data.program.session.match;
    if (ok) {
      // Equivalent translations can be swapped, but only the answered English word is credited.
      game.pending = game.pending.filter(id => id !== card.id);
      game.done.push(card.id);
      card.matchDifficulty = Math.max(0, (card.matchDifficulty || 0) - 1);
      store.data.pts += 4;
    } else {
      // Only the English word you tried to match counts as a mistake; the Turkish
      // tile you picked belongs to a word you may well know.
      daily.dailyMistake(card.id);
      card.matchDifficulty = Math.min(8, (card.matchDifficulty || 0) + 2);
      game.pending = [...game.pending.filter(id => id !== card.id), card.id];
    }
    playState.match.pick.forEach(b => b.classList.add(ok ? 'done' : 'bad'));
    store.save();
    decks.renderStats();
    playState.match.timer = setTimeout(() => {
      playState.match.timer = null;
      if (!daily.refreshDailyDay())daily.dailyBuildMatch();
    }, ok ? 450 : 600);
  }

  Object.assign(daily, {
    startDailyGame,
    dailyGameStatus,
    restartDailyGame,
    dailyShowQuiz,
    dailyAnswerQuiz,
    dailyBuildMatch,
    dailyPickMatch
  });
})();
