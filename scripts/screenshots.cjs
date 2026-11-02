// Captures the README screenshots (docs/screenshots) with demo YDS words.
// Usage: npm run screenshots. Uses the installed Chrome; set CHROME_PATH to use another browser.
const puppeteer = require('puppeteer-core');
const path = require('node:path');
const fs = require('node:fs');

const project = path.resolve(__dirname, '..');
const chromePaths = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome'
];
const executablePath = chromePaths.find(p => p && fs.existsSync(p));
if (!executablePath) {
  console.error('Chrome bulunamadı. CHROME_PATH ile tarayıcının yolunu ver.');
  process.exit(1);
}
const out = path.join(project, 'docs/screenshots');
fs.mkdirSync(out, { recursive: true });

const words = [
  ['abate', 'azalmak, dinmek', 'The storm began to abate after midnight.', 'Fırtına gece yarısından sonra dinmeye başladı.', 'subside, diminish', 'intensify'],
  ['bolster', 'desteklemek, güçlendirmek', 'The new data bolster the theory.', 'Yeni veriler kuramı destekliyor.', 'reinforce, support', 'undermine'],
  ['curb', 'dizginlemek, sınırlamak', 'The government tried to curb inflation.', 'Hükümet enflasyonu dizginlemeye çalıştı.', 'restrain, limit', 'encourage'],
  ['deteriorate', 'kötüleşmek', 'His health continued to deteriorate.', 'Sağlığı kötüleşmeye devam etti.', 'decline, worsen', 'improve'],
  ['elicit', 'ortaya çıkarmak', 'The question failed to elicit a response.', 'Soru bir yanıt ortaya çıkaramadı.', 'evoke, draw out', ''],
  ['feasible', 'uygulanabilir', 'The plan is technically feasible.', 'Plan teknik olarak uygulanabilir.', 'viable, practicable', 'impractical'],
  ['hinder', 'engellemek', 'Bad weather may hinder the rescue.', 'Kötü hava kurtarmayı engelleyebilir.', 'impede, obstruct', 'facilitate'],
  ['inevitable', 'kaçınılmaz', 'Some changes are inevitable.', 'Bazı değişiklikler kaçınılmazdır.', 'unavoidable', 'avoidable'],
  ['mitigate', 'hafifletmek', 'Trees can mitigate the effects of heat.', 'Ağaçlar sıcağın etkilerini hafifletebilir.', 'alleviate, ease', 'aggravate'],
  ['notion', 'kavram, düşünce', 'The notion of time is complex.', 'Zaman kavramı karmaşıktır.', 'concept, idea', ''],
  ['obsolete', 'modası geçmiş', 'This technology is now obsolete.', 'Bu teknoloji artık modası geçmiş.', 'outdated', 'modern'],
  ['prevalent', 'yaygın', 'The disease is prevalent in the region.', 'Hastalık bölgede yaygındır.', 'widespread, common', 'rare'],
  ['scrutinize', 'dikkatle incelemek', 'Experts scrutinize every detail.', 'Uzmanlar her ayrıntıyı dikkatle inceler.', 'examine, inspect', ''],
  ['tedious', 'sıkıcı, usandırıcı', 'Data entry can be tedious.', 'Veri girişi sıkıcı olabilir.', 'boring, dull', 'exciting'],
  ['undermine', 'baltalamak', 'Rumours can undermine trust.', 'Söylentiler güveni baltalayabilir.', 'weaken, sabotage', 'bolster'],
  ['vulnerable', 'savunmasız, hassas', 'Children are vulnerable to the virus.', 'Çocuklar virüse karşı savunmasızdır.', 'susceptible', 'resistant'],
  ['allocate', 'tahsis etmek', 'They allocate funds to research.', 'Araştırmaya fon tahsis ediyorlar.', 'assign, distribute', ''],
  ['comprehensive', 'kapsamlı', 'The report is comprehensive.', 'Rapor kapsamlıdır.', 'thorough, extensive', 'limited'],
  ['diminish', 'azalmak', 'The pain will diminish over time.', 'Acı zamanla azalacak.', 'decrease, lessen', 'increase'],
  ['enhance', 'geliştirmek, artırmak', 'Music can enhance learning.', 'Müzik öğrenmeyi geliştirebilir.', 'improve, boost', 'reduce'],
  ['fluctuate', 'dalgalanmak', 'Prices fluctuate every season.', 'Fiyatlar her mevsim dalgalanır.', 'vary, oscillate', 'stabilize'],
  ['impose', 'dayatmak, uygulamak', 'The state may impose new taxes.', 'Devlet yeni vergiler uygulayabilir.', 'enforce', 'lift'],
  ['reluctant', 'isteksiz', 'She was reluctant to leave.', 'Ayrılmaya isteksizdi.', 'unwilling, hesitant', 'eager'],
  ['sustain', 'sürdürmek', 'We cannot sustain this growth.', 'Bu büyümeyi sürdüremeyiz.', 'maintain, continue', 'abandon']
];
const card = (w, i) => ({ id: 'w' + i, en: w[0], tr: w[1], ex: w[2], exTr: w[3], synonyms: w[4], antonyms: w[5], box: 1, due: 0 });
const cards = words.map(card);
const data = {
  decks: { '2025 YDS': cards.slice(0, 16), '2024 YDS': cards.slice(16) },
  pts: 340, streak: 6, last: '', today: 0, cur: null, lastView: { type: 'home' }
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath,
    headless: true, args: ['--allow-file-access-from-files']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 1.5 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  const url = require('node:url').pathToFileURL(path.join(project, 'index.html')).href;
  await page.goto(url);
  await page.evaluate(d => { localStorage.clear(); localStorage.setItem('flashcards_v1', JSON.stringify(d)); }, data);
  await page.reload({ waitUntil: 'load' });
  const shot = async (name, full = false, clipTo = null) => {
    await new Promise(r => setTimeout(r, 400));
    if (clipTo) {
      const bottom = await page.evaluate(id => document.getElementById(id).getBoundingClientRect().bottom + window.scrollY + 24, clipTo);
      return page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: 1100, height: bottom }, captureBeyondViewport: true });
    }
    await page.screenshot({ path: path.join(out, name), fullPage: full });
  };
  const run = fn => page.evaluate(fn);

  // Main program for 2024 YDS words, a challenge for 2025 YDS, a few ratings and mistakes.
  await run(() => {
    const { daily, store, navigation } = Vocab;
    daily.startChallenge('2025 YDS');
    ['know', 'know', 'know', 'miss', 'know', 'hard'].forEach(q => daily.rateDaily(q));
    navigation.showHome();
    daily.beginDaily();
    ['know', 'know', 'hard', 'know'].forEach(q => daily.rateDaily(q));
    store.data.decks['2025 YDS'][3].quizDifficulty = 4;
    store.data.decks['2025 YDS'][6].matchDifficulty = 2;
    store.data.decks['2024 YDS'][1].cardDifficulty = 3;
    navigation.showHome();
  });
  await shot('home.png', false, 'decks');

  await run(() => { Vocab.daily.openChallenge('2025 YDS'); Vocab.study.flipCard(); });
  await shot('study.png');

  await run(() => Vocab.quiz.startQuiz('2025 YDS'));
  await shot('quiz.png');

  await run(() => Vocab.matching.startMatch('2025 YDS'));
  await shot('match.png', true);

  await run(() => Vocab.sentence.startSentence('2025 YDS'));
  await shot('sentence.png');

  await run(() => Vocab.typing.startTyping('2025 YDS'));
  await shot('typing.png');

  await browser.close();
  console.log('Ekran görüntüleri kaydedildi: ' + out);
})().catch(e => { console.error(e); process.exit(1); });
