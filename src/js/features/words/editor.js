// words: add a word by hand, or edit/delete one from the study card. DOM events are connected in bootstrap.js.
// One dialog serves both modes: "add" shows the category field, "edit" shows the delete button.
(() => {
  'use strict';

  const { store, study, daily, decks, words } = globalThis.Vocab;
  const { $ } = globalThis.Vocab.utils;
  const { study: studyState } = globalThis.Vocab.session;

  const FIELDS = { editEn: 'en', editTr: 'tr', editEx: 'ex', editExTr: 'exTr', editSyn: 'synonyms', editAnt: 'antonyms' };
  const DEFAULT_DECK = 'Genel';
  let editing = null;
  let adding = false;

  function currentCard() {
    return studyState.queue[studyState.index] || null;
  }

  function fill(card) {
    for (const [id, field] of Object.entries(FIELDS))$(id).value = card ? card[field] || '' : '';
    $('wordError').textContent = '';
    $('wordStatus').textContent = '';
  }

  function setMode(add) {
    adding = add;
    $('wordEditorTitle').textContent = add ? 'Kelime ekle' : 'Kelimeyi düzenle';
    $('editCatRow').hidden = !add;
    $('wordEditorCat').hidden = add;
    $('wordDelete').hidden = add;
    $('wordSaveNext').hidden = !add;
    $('wordSave').textContent = add ? 'Kaydet ve kapat' : 'Kaydet';
  }

  function openEditor(card = words.currentCard()) {
    if (!card)return false;
    editing = card;
    setMode(false);
    fill(card);
    $('wordEditorCat').textContent = store.cardCat(card);
    $('wordEditor').showModal();
    return true;
  }

  // Suggests existing categories; starts with the last category used for manual entry.
  function openAdder(deckName) {
    editing = null;
    setMode(true);
    fill(null);
    const names = Object.keys(store.data.decks), list = $('deckNames');
    list.innerHTML = '';
    for (const name of names) {
      const option = document.createElement('option');
      option.value = name;
      list.append(option);
    }
    const last = store.data.lastAddDeck;
    $('editCat').value = deckName || (last && store.data.decks[last] ? last : names[0] || DEFAULT_DECK);
    $('wordEditor').showModal();
    return true;
  }

  function closeEditor() {
    const changed = adding;
    editing = null;
    adding = false;
    if ($('wordEditor').open)$('wordEditor').close();
    // Words added in this dialog appear in the category list right away.
    if (changed)decks.renderDecks();
  }

  function readValues() {
    const values = {};
    for (const [id, field] of Object.entries(FIELDS))values[field] = $(id).value.trim();
    $('wordStatus').textContent = '';
    if (!values.en || !values.tr) {
      $('wordError').textContent = 'İngilizce kelime ve Türkçe karşılık boş bırakılamaz.';
      return null;
    }
    return values;
  }

  function addWord(keepOpen = false) {
    const values = readValues();
    if (!values)return false;
    const deckName = $('editCat').value.trim() || DEFAULT_DECK;
    if (store.hasWord(deckName, values.en)) {
      $('wordError').textContent = '"' + values.en + '" bu kategoride zaten var.';
      return false;
    }
    store.data.decks[deckName] ||= [];
    store.data.decks[deckName].push(store.createCard(values));
    store.data.lastAddDeck = deckName;
    store.save();
    if (keepOpen) {
      // Fast entry: keep the category, clear the word fields and start the next word.
      fill(null);
      $('wordStatus').textContent = '"' + values.en + '" ' + deckName + ' kategorisine eklendi. Sıradaki kelimeyi yazabilirsin.';
      $('editEn').focus?.();
      return true;
    }
    closeEditor();
    return true;
  }

  function saveEdit(keepOpen = false) {
    if (adding)return addWord(keepOpen);
    const card = editing;
    if (!card)return false;
    const values = readValues();
    if (!values)return false;
    if (store.hasWord(store.cardCat(card), values.en, card)) {
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
    openAdder,
    closeEditor,
    addWord,
    saveEdit,
    deleteEdited
  });
})();
