// words: edit or delete a single word from the study card. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, study, daily, words } = globalThis.Vocab;
  const { $ } = globalThis.Vocab.utils;
  const { study: studyState } = globalThis.Vocab.session;

  const FIELDS = { editEn: 'en', editTr: 'tr', editEx: 'ex', editExTr: 'exTr', editSyn: 'synonyms', editAnt: 'antonyms' };
  let editing = null;

  function currentCard() {
    return studyState.queue[studyState.index] || null;
  }

  function openEditor(card = words.currentCard()) {
    if (!card)return false;
    editing = card;
    for (const [id, field] of Object.entries(FIELDS))$(id).value = card[field] || '';
    $('wordError').textContent = '';
    $('wordEditorCat').textContent = store.cardCat(card);
    $('wordEditor').showModal();
    return true;
  }

  function closeEditor() {
    editing = null;
    if ($('wordEditor').open)$('wordEditor').close();
  }

  function saveEdit() {
    const card = editing;
    if (!card)return false;
    const values = {};
    for (const [id, field] of Object.entries(FIELDS))values[field] = $(id).value.trim();
    if (!values.en || !values.tr) {
      $('wordError').textContent = 'İngilizce kelime ve Türkçe karşılık boş bırakılamaz.';
      return false;
    }
    const deck = store.data.decks[store.cardCat(card)] || [];
    if (deck.some(other => other !== card && other.en.toLowerCase() === values.en.toLowerCase())) {
      $('wordError').textContent = '"' + values.en + '" bu kategoride zaten var.';
      return false;
    }
    Object.assign(card, values);
    store.save();
    closeEditor();
    study.showCard();
    return true;
  }

  function deleteEdited() {
    const card = editing;
    if (!card || !confirm('"' + card.en + '" silinsin mi? Bu kelimenin ilerlemesi de silinir.'))return false;
    const deck = store.data.decks[store.cardCat(card)];
    if (deck)deck.splice(deck.indexOf(card), 1);
    if (store.data.cur === card.id)store.data.cur = null;
    // Removes the word from the daily session, game queues and schedule.
    if (store.data.program)daily.ensureDaily();
    store.save();
    closeEditor();
    study.showCard();
    return true;
  }

  Object.assign(words, {
    currentCard,
    openEditor,
    closeEditor,
    saveEdit,
    deleteEdited
  });
})();
