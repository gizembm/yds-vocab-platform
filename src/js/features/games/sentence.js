// sentence: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, decks, navigation, sentence, daily } = globalThis.Vocab;
  const { $, shuffle } = globalThis.Vocab.utils;

  const { play: playState } = globalThis.Vocab.session;

  const englishKey = text => text.trim().toLowerCase();

  function sentencePrompt(card) {
    const word = (card.en || '').trim(), example = (card.ex || '').trim();
    if (!word || !example)return null;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const pattern = new RegExp('(?<![\\p{L}\\p{N}_])' + escaped + '(?![\\p{L}\\p{N}_])', 'giu');
    const prompt = example.replace(pattern, '_____');
    return prompt === example ? null : prompt;
  }

  function sentenceCards(cards) {
    return cards.filter(c => sentence.sentencePrompt(c) !== null);
  }

  function sentenceOptions(card, cards) {
    const seen = new Set([sentence.englishKey(card.en)]), wrong = [];
    for (const c of [...shuffle(cards), ...shuffle(store.allCards())]) {
      const key = sentence.englishKey(c.en);
      if (!key || seen.has(key))continue;
      seen.add(key);
      wrong.push(c.en.trim());
      if (wrong.length === 3)break;
    }
    return wrong.length === 3 ? shuffle([card.en.trim(), ...wrong]) : [];
  }

  function startSentence(name) {
    navigation.showPlay('sentence', name);
    $('playTitle').textContent = 'Cümle Tamamla';
    $('playHint').textContent = 'İngilizce cümledeki boşluğu dört seçenekten doğru kelimeyle tamamla.';
    playState.quiz.list = shuffle(sentence.sentenceCards(store.cardsOf(name))).map((card, i) => ({
      card, due : i
    }));
    playState.quiz.step = 0;
    sentence.showSentence();
  }

  function showSentence() {
    if (playState.daily)daily.dailyGameStatus();
    const cards = playState.daily ? daily.dailyCards() : store.cardsOf(playState.scope);
    const game = playState.daily ? store.data.program.session.sentence : null;
    const c = game ? cards.find(c => c.id === game.pending[0]) : playState.quiz.list[0]?.card;
    const choices = $('quizChoices');
    choices.innerHTML = '';
    playState.quiz.locked = false;
    $('quizFeedback').textContent = '';
    $('quizFeedback').className = 'feedback';
    $('quizCat').textContent = c ? store.cardCat(c) : '';
    $('quizWord').textContent = c ? sentence.sentencePrompt(c) : '';
    $('quizWord').lang = 'en';
    $('quizExample').textContent = '';
    if (!c) {
      if (!game || !sentence.sentenceCards(cards).length)$('quizFeedback').textContent = 'Bu seçimde kelimenin geçtiği örnek cümle bulunamadı. Dosyana İngilizce kelimeyi içeren örnek cümleler ekle.';
      return;
    }
    const options = sentence.sentenceOptions(c, cards);
    if (!options.length) {
      $('quizFeedback').textContent = 'Dört seçenek için kelime listende en az 4 farklı İngilizce kelime bulunmalı.';
      return;
    }
    options.forEach(opt => {
      const button = document.createElement('button');
      button.type = 'button';
      button.lang = 'en';
      button.textContent = opt;
      button.onclick = () => sentence.answerSentence(button, sentence.englishKey(opt) === sentence.englishKey(c.en), c);
      choices.append(button);
    });
  }

  function answerSentence(button, ok, c) {
    if (playState.daily && daily.refreshDailyDay() || playState.quiz.locked)return;
    playState.quiz.locked = true;
    button.classList.add(ok ? 'good' : 'bad');
    [...$('quizChoices').children].forEach(b => {
      b.disabled = true;
      if (sentence.englishKey(b.textContent) === sentence.englishKey(c.en))b.classList.add('good');
    });
    $('quizFeedback').textContent = (ok ? 'Doğru! ' : 'Doğru cevap: ' + c.en + '. ') + c.ex;
    $('quizFeedback').classList.add(ok ? 'good' : 'bad');
    if (ok) {
      store.data.pts += 5;
      c.sentenceCorrect = (c.sentenceCorrect || 0) + 1;
    }
    if (playState.daily) {
      const game = store.data.program.session.sentence, id = game.pending.shift();
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
        if (!daily.refreshDailyDay())sentence.showSentence();
        return;
      }
      const current = playState.quiz.list.shift();
      playState.quiz.step = Math.max(playState.quiz.step, current.due) + 1;
      current.due = playState.quiz.step + (ok ? Math.max(8, playState.quiz.list.length * 2) : 2);
      playState.quiz.list.push(current);
      playState.quiz.list.sort((a, b) => a.due - b.due);
      sentence.showSentence();
    }, 2000);
  }

  Object.assign(sentence, {
    sentencePrompt,
    sentenceCards,
    sentenceOptions,
    startSentence,
    showSentence,
    answerSentence,
    englishKey
  });
})();
