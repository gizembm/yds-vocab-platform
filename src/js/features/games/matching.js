// matching: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, decks, navigation, matching, daily } = globalThis.Vocab;
  const { $, shuffle } = globalThis.Vocab.utils;

  const { play: playState } = globalThis.Vocab.session;

  function startMatch(name) {
    navigation.showPlay('match', name);
    $('playTitle').textContent = 'Eşleştirme';
    $('playHint').textContent = 'İngilizce kelimeyi Türkçe karşılığıyla eşleştir.';
    matching.buildMatch();
  }

  function buildMatch() {
    if (playState.daily) {
      daily.dailyBuildMatch();
      return;
    }
    clearTimeout(playState.match.timer);
    playState.match.timer = null;
    const board = $('matchBoard');
    board.innerHTML = '';
    playState.match.pick = [];
    playState.match.cards = [];
    playState.match.seen = new Map();
    const pool = store.cardsOf(playState.scope);
    if (pool.length < 2) {
      board.innerHTML = '<p class="hint">Eşleştirme için en az 2 kelime gerekir.</p>';
      return;
    }
    while (playState.match.cards.length < Math.min(6, pool.length)) {
      const card = matching.chooseMatchCard(pool.filter(c => !playState.match.cards.includes(c)));
      playState.match.cards.push(card);
    }
    ['en', 'tr'].forEach(type => {
      const column = document.createElement('div');
      column.className = 'match-column';
      const heading = document.createElement('h3');
      heading.textContent = type === 'en' ? 'İngilizce' : 'Türkçe';
      column.append(heading);
      const cards = type === 'en' ? playState.match.cards : shuffle(playState.match.cards);
      cards.forEach(card => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.type = type;
        b.lang = type;
        b.onclick = () => matching.pickMatch(b);
        matching.setMatchTile(b, card);
        column.append(b);
      });
      board.append(column);
    });
  }

  function chooseMatchCard(cards) {
    // Weighted sampling favors difficult words; exposure counts keep the rest in rotation.
    const weights = cards.map(c => (1 + 3 * Math.min(8, c.matchDifficulty || 0)) / (1 + (playState.match.seen.get(c.id) || 0)));
    let ticket = Math.random() * weights.reduce((sum, w) => sum + w, 0);
    const card = cards.find((c, i) => (ticket -= weights[i]) < 0) || cards[cards.length - 1];
    playState.match.seen.set(card.id, (playState.match.seen.get(card.id) || 0) + 1);
    return card;
  }

  function setMatchTile(btn, card) {
    btn.className = 'match-card';
    btn.textContent = card[btn.dataset.type];
    btn.dataset.id = card.id;
    btn.setAttribute('aria-pressed', 'false');
  }

  function pickMatch(btn) {
    if (playState.daily) {
      daily.dailyPickMatch(btn);
      return;
    }
    if (playState.match.timer !== null || playState.match.pick.includes(btn))return;
    if (playState.match.pick.length && playState.match.pick[0].dataset.type === btn.dataset.type) {
      playState.match.pick[0].classList.remove('active');
      playState.match.pick[0].setAttribute('aria-pressed', 'false');
      playState.match.pick = [];
    }
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    playState.match.pick.push(btn);
    if (playState.match.pick.length < 2)return;
    const [a, b] = playState.match.pick, card = playState.match.cards.find(c => c.id === a.dataset.id);
    const ok = a.dataset.id === b.dataset.id ||
    (a.dataset.type === 'en' ? b.textContent === card.tr : a.textContent === playState.match.cards.find(c => c.id === b.dataset.id).tr);
    if (ok) {
      a.classList.remove('active');
      b.classList.remove('active');
      a.classList.add('done');
      b.classList.add('done');
      card.matchDifficulty = Math.max(0, (card.matchDifficulty || 0) - 1);
      store.data.pts += 4;
      store.save();
      decks.renderStats();
      playState.match.timer = setTimeout(() => {
        // Equivalent translations may belong to different cards; replace their actual partners.
        const oldIds = new Set([a.dataset.id, b.dataset.id]);
        oldIds.forEach(id => {
          const tiles = [...$('matchBoard').querySelectorAll('.match-card')].filter(tile => tile.dataset.id === id);
          const candidates = store.cardsOf(playState.scope).filter(c => !playState.match.cards.includes(c));
          const next = candidates.length ? matching.chooseMatchCard(candidates) : playState.match.cards.find(c => c.id === id);
          playState.match.cards[playState.match.cards.findIndex(c => c.id === id)] = next;
          tiles.forEach(tile => matching.setMatchTile(tile, next));
        });
        playState.match.pick = [];
        playState.match.timer = null;
      }, 450);
    } else {
      // Only the English word counts as the mistake.
      const enTile = a.dataset.type === 'en' ? a : b;
      const wrong = playState.match.cards.find(c => c.id === enTile.dataset.id);
      wrong.matchDifficulty = Math.min(8, (wrong.matchDifficulty || 0) + 2);
      daily.registerMistake(wrong.id);
      store.save();
      a.classList.add('bad');
      b.classList.add('bad');
      playState.match.timer = setTimeout(() => {
        [a, b].forEach(tile => {
          tile.classList.remove('active', 'bad');
          tile.setAttribute('aria-pressed', 'false');
        });
        playState.match.pick = [];
        playState.match.timer = null;
      }, 600);
    }
  }

  Object.assign(matching, {
    startMatch,
    buildMatch,
    chooseMatchCard,
    setMatchTile,
    pickMatch
  });
})();
