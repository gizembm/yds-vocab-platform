// daily-scheduler: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { config, store, decks, study, sentence, daily } = globalThis.Vocab;
  const { $ } = globalThis.Vocab.utils;

  const { study: studyState, play: playState } = globalThis.Vocab.session;

  // A learned word returns after 1, 3, 7, 14 and 30 days.
  const REVIEW_DAYS = [1, 3, 7, 14, 30];
  const NEW_PER_DAY = 20;
  // Review cards beyond this limit move to the next day (most urgent first).
  const MAX_REVIEWS = 60;
  const MAX_DAY_CARDS = NEW_PER_DAY + MAX_REVIEWS;
  const GAME_MODES = ['quiz', 'match', 'sentence', 'synonyms', 'antonyms'];
  // Offered in the daily program but never required to move to the next day.
  const OPTIONAL_GAMES = ['synonyms', 'antonyms'];
  const relationTerms = (card, relation) => String(card[relation] || '').split(/[;,/|]/).map(x => x.trim()).filter(Boolean);

  const programDate = (time = Date.now()) => new Intl.DateTimeFormat('en-CA', {
    timeZone : 'Europe/Istanbul', year : 'numeric', month : '2-digit', day : '2-digit'
  }).format(time);
  const dateNumber = date => Date.parse(date + 'T00:00:00Z') / config.DAY;
  const plusDays = (date, days) => new Date((daily.dateNumber(date) + days) * config.DAY).toISOString().slice(0, 10);
  const cycleOf = () => Math.floor((store.data.program.dayIndex || 0) / 7);
  const isReviewDay = () => (store.data.program.dayIndex || 0) % 7 === 6;
  const dailyCards = () => {
    const ids = new Set(store.data.program.session.ids);
    return store.allCards().filter(c => ids.has(c.id));
  };

  // Games use today's new words plus the words that were hard or missed today.
  // Older reviews are cleared with cards only, so long review days stay short.
  function gamePool() {
    const s = store.data.program.session, keep = new Set([...s.newIds, ...(s.missed || [])]);
    return daily.dailyCards().filter(c => keep.has(c.id));
  }

  function gameIds(mode, pool = daily.gamePool()) {
    if (mode === 'sentence')return sentence.sentenceCards(pool).map(c => c.id);
    if (mode === 'synonyms' || mode === 'antonyms')return pool.filter(c => relationTerms(c, mode).length).map(c => c.id);
    return pool.map(c => c.id);
  }

  // Single source of truth for whether a daily game can be played (and is therefore required).
  function gameAvailable(mode, pool = daily.gamePool()) {
    if (!GAME_MODES.includes(mode))return false;
    const ids = daily.gameIds(mode, pool), options = daily.dailyCards();
    if (!ids.length)return false;
    if (mode === 'match')return ids.length >= 2;
    if (mode === 'quiz')return new Set(options.map(c => c.tr)).size >= 2;
    if (mode === 'sentence')return new Set(store.allCards().map(c => sentence.englishKey(c.en))).size >= 4;
    return new Set(options.flatMap(c => relationTerms(c, mode))).size >= 2;
  }

  function requiredGames() {
    const pool = daily.gamePool();
    return GAME_MODES.filter(mode => !OPTIONAL_GAMES.includes(mode) && daily.gameAvailable(mode, pool));
  }

  function optionalGames() {
    const pool = daily.gamePool();
    return OPTIONAL_GAMES.filter(mode => daily.gameAvailable(mode, pool));
  }

  function gamesComplete(s = store.data.program.session) {
    return !s.pending.length && daily.requiredGames().every(mode => s[mode]?.pending?.length === 0);
  }

  // Review order: forgotten words, the previous session's new words,
  // overdue reviews (oldest first) and, on the 7th day, the rest of the week's words.
  // Returns every candidate; the caller applies the daily limit.
  function reviewCandidates(p, date) {
    const cycle = daily.cycleOf(), reviewDay = daily.isReviewDay();
    const previous = Number.isInteger(p.lastSessionDay) ? p.lastSessionDay : null;
    const rank = st => !st.learned ? 0
      : st.assignedDay === previous ? 1
      : st.due && st.due <= date ? 2
      : reviewDay && st.cycle === cycle ? 3 : null;
    return store.allCards()
      .filter(c => p.cards[c.id] && rank(p.cards[c.id]) !== null)
      .sort((a, b) => {
        const x = p.cards[a.id], y = p.cards[b.id];
        return rank(x) - rank(y) || String(x.due || '').localeCompare(String(y.due || '')) || (x.stage || 0) - (y.stage || 0);
      })
      .map(c => c.id);
  }

  function oldestCards(p) {
    return [...store.allCards()]
      .sort((a, b) => {
        const aState = p.cards[a.id], bState = p.cards[b.id];
        return String(aState?.due || aState?.assigned || '').localeCompare(String(bState?.due || bState?.assigned || ''));
      })
      .slice(0, NEW_PER_DAY)
      .map(c => c.id);
  }

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
      // or games were left unfinished.
      p.dayIndex = Math.max(p.dayIndex || 0, daily.dateNumber(date) - daily.dateNumber(p.start));
      p.session = null;
    }
    if (!p.session) {
      const cycle = daily.cycleOf(), reviewDay = daily.isReviewDay();
      const candidates = reviewCandidates(p, date);
      // Reviews that no longer fit in today's limit pause new words; the freed
      // slots go to the backlog so it shrinks instead of growing.
      const backlog = !reviewDay && candidates.length > MAX_REVIEWS;
      const reviews = candidates.slice(0, reviewDay || backlog ? MAX_DAY_CARDS : MAX_REVIEWS);
      const fresh = reviewDay || backlog ? [] : store.allCards().filter(c => !p.cards[c.id]).slice(0, NEW_PER_DAY);
      fresh.forEach(c => {
        p.cards[c.id] = {
          cycle, assigned : date, assignedDay : p.dayIndex, learned : false, stage : 0, due : null
        };
      });
      const freshIds = fresh.map(c => c.id);
      let ids = [...reviews, ...freshIds];
      // Keep a useful review day when the pool is exhausted and every learned
      // word is scheduled for a later date.
      if (!ids.length && store.allCards().length)ids = oldestCards(p);
      p.lastSessionDay = p.dayIndex;
      p.session = {
        date, ids, newIds : freshIds, backlog, missed : [], pending : [...ids], done : [], current : ids[0] || null
      };
    }
    const s = p.session;
    if (!s.ids.length && store.allCards().length) {
      s.ids = oldestCards(p);
      s.pending = [...s.ids];
      s.done = [];
      s.current = s.ids[0] || null;
    }
    // Required games are derived from the current pool; older saves stored a fixed list.
    delete s.requiredGames;
    s.missed ||= [];
    for (const mode of GAME_MODES) if (!s[mode])s[mode] = { pending : null, done : [] };
    s.hardAgain ||= [];
    for (const key of ['ids', 'newIds', 'missed', 'hardAgain', 'pending', 'done'])s[key] = s[key].filter(id => live.has(id));
    for (const game of GAME_MODES.map(mode => s[mode])) {
      if (game.pending)game.pending = game.pending.filter(id => live.has(id));
      game.done = game.done.filter(id => live.has(id));
    }
    const sentenceIds = new Set(sentence.sentenceCards(daily.dailyCards()).map(c => c.id));
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
    if (!p || !daily.gamesComplete(current))return false;
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

  function forget(state) {
    state.learned = false;
    state.stage = 0;
    state.due = null;
  }

  // A shaky recall: the word stays learned, drops one interval step and returns tomorrow.
  function demote(state, date) {
    if (!state.learned)return;
    state.stage = Math.max(0, (state.stage || 0) - 1);
    state.due = daily.plusDays(date, daily.REVIEW_DAYS[0]);
  }

  function markMissed(s, id) {
    s.missed ||= [];
    if (!s.missed.includes(id))s.missed.push(id);
  }

  function requeue(s, id) {
    s.pending.splice(Math.min(2, s.pending.length), 0, id);
  }

  // Card ratings:
  //   know: first recall starts the 1-day interval; a due review moves one step up;
  //         an early review (word not yet due) keeps its schedule.
  //   hard: a new or forgotten word counts as learned (1 day) but is shown once more today;
  //         a learned word drops one step and returns tomorrow.
  //   miss: the word is forgotten and shown again today.
  function rateDaily(q) {
    if (!['know', 'hard', 'miss'].includes(q))return;
    if (daily.refreshDailyDay())return;
    const s = daily.ensureDaily(), id = s.current, state = store.data.program.cards[id];
    if (!state || !s.pending.includes(id))return;
    s.pending = s.pending.filter(x => x !== id);
    const card = store.allCards().find(c => c.id === id);
    if (card)store.adjustDifficulty(card, 'cardDifficulty', q === 'know' ? -1 : q === 'hard' ? 1 : 2);
    s.hardAgain ||= [];
    if (q === 'know') {
      if (!state.learned) {
        state.learned = true;
        state.stage = 0;
        state.due = daily.plusDays(s.date, daily.REVIEW_DAYS[0]);
      } else if (state.due && state.due <= s.date) {
        state.stage = Math.min(daily.REVIEW_DAYS.length - 1, (state.stage || 0) + 1);
        state.due = daily.plusDays(s.date, daily.REVIEW_DAYS[state.stage]);
      }
      s.done.push(id);
      daily.recordDailyActivity(10);
    } else if (q === 'hard') {
      const wasLearned = state.learned;
      markMissed(s, id);
      if (wasLearned) {
        demote(state, s.date);
      } else {
        state.learned = true;
        state.stage = 0;
        state.due = daily.plusDays(s.date, daily.REVIEW_DAYS[0]);
      }
      if (!wasLearned && !s.hardAgain.includes(id)) {
        // New or forgotten words get one more look today; reviews are only rescheduled.
        s.hardAgain.push(id);
        requeue(s, id);
      } else {
        s.done.push(id);
      }
      daily.recordDailyActivity(3);
    } else {
      forget(state);
      markMissed(s, id);
      requeue(s, id);
      daily.recordDailyActivity(0);
    }
    s.current = s.pending[0] || null;
    store.save();
    study.showCard();
    daily.renderDaily();
  }

  // A mistake in a daily game: one step down, back to today's card study.
  function dailyMistake(id) {
    const s = store.data.program.session, state = store.data.program.cards[id];
    if (state)demote(state, s.date);
    markMissed(s, id);
    s.done = s.done.filter(x => x !== id);
    if (!s.pending.includes(id))s.pending.push(id);
    if (!s.current)s.current = id;
  }

  // A mistake in free study or free games: only words already learned in the program
  // are affected; they drop one step and come back in tomorrow's daily review.
  // Correct answers outside the program never move the schedule (early reviews).
  function registerMistake(id) {
    const state = store.data.program?.cards?.[id];
    if (state)demote(state, daily.programDate());
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
    registerMistake,
    demote,
    gamePool,
    gameIds,
    gameAvailable,
    requiredGames,
    optionalGames,
    OPTIONAL_GAMES,
    gamesComplete,
    relationTerms,
    REVIEW_DAYS,
    NEW_PER_DAY,
    MAX_REVIEWS,
    GAME_MODES,
    programDate,
    dateNumber,
    plusDays,
    cycleOf,
    isReviewDay,
    dailyCards
  });
})();
