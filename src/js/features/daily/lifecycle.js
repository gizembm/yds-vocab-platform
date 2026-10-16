// daily-lifecycle: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, navigation, daily } = globalThis.Vocab;
  const { study: studyState, play: playState } = globalThis.Vocab.session;

  let visibleProgramDate = daily.programDate();

  function refreshDailyDay() {
    const date = daily.programDate();
    if (date === visibleProgramDate)return false;
    visibleProgramDate = date;
    if (!store.data.program)return false;
    daily.ensureDaily();
    if (studyState.daily || playState.daily) {
      studyState.daily = false;
      playState.daily = false;
      navigation.showHome();
    }
    else daily.renderDaily();
    return true;
  }

  Object.assign(daily, {
    refreshDailyDay
  });
})();
