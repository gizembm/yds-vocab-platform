// daily-scheduler: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { config, store, decks, study, sentence, daily } = globalThis.Vocab;
  const { $ } = globalThis.Vocab.utils;

  const { study: studyState, play: playState } = globalThis.Vocab.session;

  const REVIEW_DAYS = [1, 3, 7, 14, 30];
  const GAME_MODES = ['quiz', 'match', 'sentence', 'synonyms', 'antonyms'];
  const relationTerms = (card, relation) => String(card[relation] || '').split(/[;,/|]/).map(x => x.trim()).filter(Boolean);
  function enabledGames(cards) {
    return GAME_MODES.filter(mode => mode === 'sentence' ? sentence.sentenceCards(cards).length > 0
      : mode === 'match' ? cards.length >= 2
      : mode === 'quiz' ? new Set(cards.map(c => c.tr)).size >= 2
      : new Set(cards.flatMap(c => relationTerms(c, mode))).size >= 2);
  }
  function gamesComplete(s) {
    return !s.pending.length && (s.requiredGames || []).every(mode => s[mode]?.pending?.length === 0);
  }
  const programDate = (time = Date.now()) => new Intl.DateTimeFormat('en-CA', {
    timeZone : 'Europe/Istanbul', year : 'numeric', month : '2-digit', day : '2-digit'
  }).format(time);
  const dateNumber = date => Date.parse(date + 'T00:00:00Z') / config.DAY;
  const plusDays = (date, days) => new Date((daily.dateNumber(date) + days) * config.DAY).toISOString().slice(0, 10);
  const cycleOf = () => Math.floor((store.data.program.dayIndex || 0) / 7);
  const dailyCards = () => {
    const ids = new Set(store.data.program.session.ids);
    return store.allCards().filter(c => ids.has(c.id));
  };

  function ensureDaily() {
    const p = store.data.program;
    if (!p)return null;
    const date = daily.programDate(), live = new Set(store.allCards().map(c => c.id));
    Object.keys(p.cards).forEach(id => {
      if (!live.has(id))delete p.cards[id];
    });
    if (!Number.isInteger(p.dayIndex))p.dayIndex = p.session ? Math.max(0, daily.dateNumber(p.session.date) - daily.dateNumber(p.start)) : 0;
    if (p.session && p.session.date !== date) {
      // Calendar days advance the program even when the previous day's cards
      // or games were left unfinished. Missed-day quotas accumulate by date.
      p.dayIndex = Math.max(p.dayIndex || 0, daily.dateNumber(date) - daily.dateNumber(p.start));
      p.session = null;
    }
    if (!p.session) {
      const cycle = daily.cycleOf(date);
      const fresh = (p.dayIndex % 7) !== 6
      ? store.allCards().filter(c => !p.cards[c.id]).slice(0, 20) : [];
      fresh.forEach(c => {
        p.cards[c.id] = {
          cycle, assigned : date, learned : false, stage : 0, due : null
        };
      });
      let ids = store.allCards().filter(c => {
        const state = p.cards[c.id];
        return state && (state.cycle === cycle || !state.learned || state.due <= date);
      }).map(c => c.id);
      // Keep a useful review day when the pool is exhausted and every learned
      // word is scheduled for a later date.
      if (!ids.length && store.allCards().length) {
        ids = [...store.allCards()]
          .sort((a, b) => {
            const aState = p.cards[a.id], bState = p.cards[b.id];
            return String(aState?.due || aState?.assigned || '').localeCompare(String(bState?.due || bState?.assigned || ''));
          })
          .slice(0, 20)
          .map(c => c.id);
      }
      p.session = {
        date, ids, newIds : fresh.map(c => c.id), pending : [...ids], done : [], current : ids[0] || null,
        quiz : {
          pending : null, done : []
        }, match : {
          pending : null, done : []
        }
      };
    }
    const s = p.session;
    if (!s.ids.length && store.allCards().length) {
      s.ids = [...store.allCards()]
        .sort((a, b) => {
          const aState = p.cards[a.id], bState = p.cards[b.id];
          return String(aState?.due || aState?.assigned || '').localeCompare(String(bState?.due || bState?.assigned || ''));
        })
        .slice(0, 20)
        .map(c => c.id);
      s.pending = [...s.ids];
      s.done = [];
      s.current = s.ids[0] || null;
    }
    const cards = daily.dailyCards();
    s.requiredGames ||= enabledGames(cards);
    for (const mode of GAME_MODES) if (!s[mode])s[mode] = { pending : null, done : [] };
    // Older saved programs have no sentence-game progress yet.
    if (!s.sentence)s.sentence = {
      pending : null, done : []
    };
    for (const key of ['ids', 'newIds', 'pending', 'done'])s[key] = s[key].filter(id => live.has(id));
    for (const game of GAME_MODES.map(mode => s[mode])) {
      if (game.pending)game.pending = game.pending.filter(id => live.has(id));
      game.done = game.done.filter(id => live.has(id));
    }
    const sentenceIds = new Set(sentence.sentenceCards(cards).map(c => c.id));
    if (s.sentence.pending)s.sentence.pending = s.sentence.pending.filter(id => sentenceIds.has(id));
    s.sentence.done = s.sentence.done.filter(id => sentenceIds.has(id));
    store.save();
    return s;
  }

  function beginDaily() {
    if (!store.allCards().length)return;
    if (!store.data.program)store.data.program = {
      version : 1, start : daily.programDate(), cards : {
      }, session : null
    };
    daily.ensureDaily();
    daily.renderDaily();
    daily.startDailyStudy();
  }

  function dailyQueue() {
    const s = daily.ensureDaily(), byId = new Map(store.allCards().map(c => [c.id, c]));
    return s.pending.map(id => byId.get(id)).filter(Boolean);
  }

  function startDailyStudy() {
    if (!store.data.program)return;
    daily.ensureDaily();
    clearTimeout(playState.quiz.timer);
    playState.quiz.timer = null;
    clearTimeout(playState.match.timer);
    playState.match.timer = null;
    studyState.daily = true;
    playState.daily = false;
    studyState.scope = null;
    store.data.lastView = { type: 'dailyStudy' };
    store.save();
    $('home').hidden = true;
    $('play').hidden = true;
    $('study').hidden = false;
    study.showCard();
  }

  function advanceDailyDay() {
    const p = store.data.program, current = daily.ensureDaily();
    if (!p || !gamesComplete(current))return false;
    p.dayIndex = (p.dayIndex || 0) + 1;
    p.session = null;
    daily.ensureDaily();
    store.save();
    daily.renderDaily();
    daily.startDailyStudy();
    return true;
  }

  function recordDailyActivity(points) {
    const date = daily.programDate();
    if (store.data.last !== date) {
      store.data.streak = store.data.last === daily.plusDays(date, - 1) ? store.data.streak + 1 : 1;
      store.data.last = date;
      store.data.today = 0;
    }
    store.data.today++;
    store.data.pts += points;
    decks.renderStats();
  }

  function rateDaily(q) {
    if (!['know', 'hard', 'miss'].includes(q))return;
    if (daily.refreshDailyDay())return;
    const s = daily.ensureDaily(), id = s.current, state = store.data.program.cards[id];
    if (!state || !s.pending.includes(id))return;
    s.pending = s.pending.filter(x => x !== id);
    if (q === 'know') {
      const scheduled = state.learned && state.cycle < daily.cycleOf(s.date) && state.due <= s.date;
      if (scheduled)state.stage = Math.min(daily.REVIEW_DAYS.length - 1, state.stage + 1);
      if (!state.learned)state.stage = 0;
      state.learned = true;
      state.due = daily.plusDays(s.date, daily.REVIEW_DAYS[state.stage]);
      s.done.push(id);
      daily.recordDailyActivity(10);
    } else {
      state.learned = false;
      state.stage = 0;
      state.due = null;
      s.pending.splice(Math.min(2, s.pending.length), 0, id);
      daily.recordDailyActivity(q === 'hard' ? 3 : 0);
    }
    s.current = s.pending[0] || null;
    store.save();
    study.showCard();
    daily.renderDaily();
  }

  function dailyMistake(id) {
    const s = store.data.program.session, state = store.data.program.cards[id];
    state.learned = false;
    state.stage = 0;
    state.due = null;
    s.done = s.done.filter(x => x !== id);
    if (!s.pending.includes(id))s.pending.push(id);
    if (!s.current)s.current = id;
  }

  Object.assign(daily, {
    ensureDaily,
    beginDaily,
    dailyQueue,
    startDailyStudy,
    advanceDailyDay,
    recordDailyActivity,
    rateDaily,
    dailyMistake,
    REVIEW_DAYS,
    programDate,
    dateNumber,
    plusDays,
    cycleOf,
    dailyCards
  });
})();
