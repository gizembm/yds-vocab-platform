// typing: see the Turkish meaning, write the English word. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, decks, navigation, sentence, typing, daily } = globalThis.Vocab;
  const { $, shuffle } = globalThis.Vocab.utils;

  const { play: playState } = globalThis.Vocab.session;

  // Turkish keyboards and phones can produce İ or ı where the English word has i.
  const normalize = text => String(text || '').replace(/[İı]/g, 'i').toLowerCase().trim().replace(/\s+/g, ' ');

  function oneEditApart(a, b) {
    if (a === b || Math.abs(a.length - b.length) > 1)return false;
    let i = 0;
    while (i < a.length && a[i] === b[i])i++;
    return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1);
  }

  // The prompt is the Turkish meaning, so every word with the same meaning is a right answer.
  function acceptedWords(card) {
    const meaning = normalize(card.tr);
    return new Set([card, ...store.allCards().filter(c => normalize(c.tr) === meaning)].map(c => normalize(c.en)));
  }

  // 'close' is a one-letter slip in a word of at least four letters.
  function gradeAnswer(answer, card) {
    const typed = normalize(answer), word = normalize(card.en);
    if (acceptedWords(card).has(typed))return 'correct';
    return word.length >= 4 && oneEditApart(typed, word) ? 'close' : 'wrong';
  }

  function startTyping(name) {
    const resumeId = store.data.lastView?.mode === 'typing' && store.data.lastView.scope === (name || null)
      ? store.data.lastView.cardId : null;
    navigation.showPlay('typing', name);
    $('playTitle').textContent = 'Kelime Yaz';
    $('playHint').textContent = 'Türkçe karşılığı verilen kelimenin İngilizcesini yaz.';
    playState.quiz.list = shuffle(store.cardsOf(name)).map((card, i) => ({ card, due: i }));
    const resumeIndex = playState.quiz.list.findIndex(item => item.card.id === resumeId);
    if (resumeIndex > 0)playState.quiz.list.push(...playState.quiz.list.splice(0, resumeIndex));
    playState.quiz.step = 0;
    typing.showTyping();
  }

  function showTyping() {
    if (playState.daily)daily.dailyGameStatus();
    const game = playState.daily ? daily.program().session.typing : null;
    const c = game ? daily.dailyCards().find(card => card.id === game.pending[0]) : playState.quiz.list[0]?.card;
    const input = $('typingInput');
    playState.quiz.current = c || null;
    playState.quiz.retried = false;
    playState.quiz.locked = false;
    $('quizChoices').innerHTML = '';
    $('quizFeedback').textContent = '';
    $('quizFeedback').className = 'feedback';
    $('quizCat').textContent = c ? store.cardCat(c) : '';
    $('quizWord').textContent = c ? c.tr : '';
    $('quizWord').lang = 'tr';
    $('quizExample').textContent = c ? sentence.sentencePrompt(c) || '' : '';
    $('typingForm').hidden = !c;
    input.value = '';
    input.disabled = false;
    if (!c) {
      if (!game)$('quizFeedback').textContent = 'Bu seçimde kelime yok.';
      return;
    }
    if (!game && store.data.lastView?.type === 'play') {
      store.data.lastView.cardId = c.id;
      store.save();
    }
    input.focus?.();
  }

  function submitTyping() {
    if (playState.daily && daily.refreshDailyDay() || playState.quiz.locked)return;
    const c = playState.quiz.current, input = $('typingInput');
    if (!c || !normalize(input.value))return;
    const result = typing.gradeAnswer(input.value, c), feedback = $('quizFeedback');
    if (result === 'close' && !playState.quiz.retried) {
      playState.quiz.retried = true;
      feedback.textContent = 'Çok yaklaştın, bir harf farklı. Tekrar dene.';
      feedback.className = 'feedback';
      input.focus?.();
      return;
    }
    const ok = result === 'correct', sameWord = normalize(input.value) === normalize(c.en);
    playState.quiz.locked = true;
    input.disabled = true;
    feedback.textContent = (ok ? 'Doğru! ' + (sameWord ? '' : 'Bu kartın kelimesi: ' + c.en + '. ') : 'Doğru cevap: ' + c.en + '. ') + (c.ex || '');
    feedback.className = 'feedback ' + (ok ? 'good' : 'bad');
    if (ok) {
      store.data.pts += 5;
      c.typingCorrect = (c.typingCorrect || 0) + 1;
    }
    store.adjustDifficulty(c, 'typingDifficulty', ok ? -1 : 2);
    if (!ok && !playState.daily)daily.registerMistake(c.id);
    if (playState.daily) {
      const game = daily.program().session.typing, id = game.pending.shift();
      if (ok)game.done.push(id);
      else {
        game.pending.splice(Math.min(2, game.pending.length), 0, id);
        daily.dailyMistake(id);
      }
    }
    store.save();
    decks.renderStats();
    playState.quiz.timer = setTimeout(() => {
      playState.quiz.timer = null;
      if (playState.daily) {
        if (!daily.refreshDailyDay())typing.showTyping();
        return;
      }
      const current = playState.quiz.list.shift();
      playState.quiz.step = Math.max(playState.quiz.step, current.due) + 1;
      current.due = playState.quiz.step + (ok ? Math.max(8, playState.quiz.list.length * 2) : 2);
      playState.quiz.list.push(current);
      playState.quiz.list.sort((a, b) => a.due - b.due);
      typing.showTyping();
    }, ok ? 1500 : 2500);
  }

  Object.assign(typing, {
    gradeAnswer,
    startTyping,
    showTyping,
    submitTyping
  });
})();
