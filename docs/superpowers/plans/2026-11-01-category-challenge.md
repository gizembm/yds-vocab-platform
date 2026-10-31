# Kategori meydan okuması — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her kategori için ana 20 kelimelik programla aynı kurallarda işleyen, günde 10 yeni kelimelik ayrı bir günlük program (meydan okuma).

**Architecture:** Günlük zamanlayıcı tek bir `store.data.program` yerine "etkin program" (`daily.program()`) üzerinde çalışır. Meydan okumalar `store.data.challenges[kategori]` altında ana programla aynı yapıda tutulur; her programın kelime havuzu `daily.programCards(p)` ile, günlük sınırları `daily.limits(p)` ile belirlenir. Başlatma/bırakma/tamamlanma yeni `daily/challenges.js` dosyasındadır.

**Tech Stack:** Düz JavaScript (klasik betikler, `globalThis.Vocab`), localStorage, `node --test` + `vm` tabanlı test ortamı (`tests/helpers/load-app.cjs`).

**Spec:** `docs/superpowers/specs/2026-11-01-category-challenge-design.md`

## Global Constraints

- Ana program sınırları değişmez: 20 yeni, 60 tekrar, 80 kart. Meydan okuma: 10 yeni, 30 tekrar, 40 kart.
- Tekrar aralıkları ortak: 1, 3, 7, 14, 30 gün; 7. gün (`dayIndex % 7 === 6`) genel tekrar günü.
- `store.data.program` yapısı ve `flashcards_v1` anahtarı geriye dönük uyumlu kalır; `store.data.challenges` yoksa `{}` sayılır.
- Arayüz metinleri Türkçe: `Meydan okuma`, `Devam et`, `Meydan okumayı bırak`, `Tamamlandı`.
- Bütün mevcut testler (`npm test`, şu an 58) değişmeden geçer.
- Kod stili çevredeki dosyalarla aynı: IIFE + `'use strict'`, fonksiyonlar `Object.assign(daily, {...})` ile dışa açılır, testler `tests/*.test.cjs` içinde `setup()` + `g.run()` kalıbında.

## Review Focus

1. Ana programın bugünkü oturumu zaten açıkken bir kategorinin meydan okuması başlatılır → o kategorinin kelimeleri ana programın bugünkü `ids`/`pending`/`newIds` listelerinden hemen çıkar (Task 2 testi).
2. Boş kategoride `Meydan okuma` → buton devre dışı, `startChallenge` hiçbir şey yapmaz (Task 2 testi).
3. Meydan okuma ekranındayken gün değişir (`refreshDailyDay`) → etkin meydan okuma yeni güne geçer, ana ekrana dönülür; ana programın günü de ilerler (Task 1 testi).
4. `challenges` alanı olmayan eski kayıt/yedek yüklenir → uygulama hatasız açılır, ana program aynı çalışır (Task 1 testi).
5. Sayfa meydan okuma kartları veya oyunu açıkken yenilenir → `lastView.program` sayesinde aynı meydan okuma açılır (Task 2 testi).

---

### Task 1: Zamanlayıcıyı etkin programa bağla

**Files:**
- Modify: `src/js/core/session.js` (yeni `session.daily = { deck: null }`)
- Modify: `src/js/features/daily/scheduler.js`
- Modify: `src/js/features/daily/games.js`, `src/js/features/daily/view.js`, `src/js/features/daily/lifecycle.js`, `src/js/features/games/sentence.js`, `src/js/features/study/study.js`, `src/js/features/words/editor.js`
- Test: `tests/challenge.test.cjs` (yeni; `tests/daily.test.cjs` içindeki `setup()` kalıbını kopyalar)

**Interfaces:**
- Produces:
  - `daily.program(): Program | null` — `session.daily.deck` doluysa `store.data.challenges?.[deck]`, değilse `store.data.program`.
  - `daily.programCards(p: Program): Card[]` — `p.deck` varsa `store.data.decks[p.deck] || []`; yoksa meydan okuması olan kategoriler dışındaki tüm kartlar.
  - `daily.limits(p: Program): { newPerDay, maxReviews, maxDayCards }` — `{10,30,40}` / `{20,60,80}`.
  - `daily.ensureDaily(p = daily.program())` — verilen programın oturumunu hazırlar (Task 2 başka programlar için çağırır).
  - `daily.cycleOf(p = daily.program())`, `daily.isReviewDay(p = daily.program())`.
  - Program nesnesi: `{ version, start, dayIndex, cards, session, lastSessionDay, deck? }`.

- [ ] **Step 1: Write the failing tests** (`tests/challenge.test.cjs`)

```js
test('a challenge program opens 10 new words a day from its own deck only',()=>{
  const g=setup(30);
  g.run("S.decks.YDS=S.decks.Test.splice(0,15);S.challenges={YDS:{version:1,deck:'YDS',start:programDate(),cards:{},session:null}};Vocab.session.daily.deck='YDS';");
  const s=g.value('ensureDaily()');
  assert.equal(s.newIds.length,10);
  assert.ok(s.ids.every(id=>Number(id)<15));
  assert.deepEqual(g.value('limits(program())'),{newPerDay:10,maxReviews:30,maxDayCards:40});
});

test('the main program skips decks that have a challenge',()=>{
  const g=setup(30);
  g.run("S.decks.YDS=S.decks.Test.splice(0,15);S.challenges={YDS:{version:1,deck:'YDS',start:programDate(),cards:{},session:null}};");
  g.begin();
  assert.ok(session(g).ids.every(id=>Number(id)>=15));
});

test('the 7th challenge day opens no new words',()=>{
  const g=setup(0);
  g.run("S.decks.YDS=Array.from({length:100},(_,i)=>({id:'y'+i,en:'w'+i,tr:'m'+i,box:1,due:0}));S.challenges={YDS:{version:1,deck:'YDS',start:programDate(),dayIndex:6,cards:{},session:null}};Vocab.session.daily.deck='YDS';");
  assert.equal(g.value('ensureDaily()').newIds.length,0);
});

test('the home panel keeps showing the main program during a challenge',()=>{
  const g=setup(30);g.begin();
  g.run("S.decks.YDS=S.decks.Test.splice(0,15);S.challenges={YDS:{version:1,deck:'YDS',start:programDate(),cards:{},session:null}};Vocab.session.daily.deck='YDS';renderDaily();");
  assert.match(g.elements.get('programSummary').children.map(c=>c.textContent).join(' '),/^1\. hafta, 1\. gün 15 yeni/);
});

test('saves without challenges still run the main program',()=>{
  const g=setup(30);g.run('delete S.challenges');g.begin();
  assert.equal(session(g).newIds.length,20);
});

test('a day change while in a challenge returns home and advances it',()=>{
  const g=setup(30);
  g.run("S.decks.YDS=S.decks.Test.splice(0,15);S.challenges={YDS:{version:1,deck:'YDS',start:programDate(),cards:{},session:null}};Vocab.session.daily.deck='YDS';ensureDaily();startDailyStudy();");
  g.day(1);
  assert.equal(g.run('studyDaily'),false);
  assert.equal(g.run("S.challenges.YDS.session===null||S.challenges.YDS.session.date===programDate()"),true);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/challenge.test.cjs`
Expected: FAIL (`program is not defined` / `limits is not defined`).

- [ ] **Step 3: Implement**

- `scheduler.js`: `NEW_PER_DAY`/`MAX_REVIEWS`/`MAX_DAY_CARDS` sabitlerini `daily.limits(p)` ile değiştir (`NEW_PER_DAY` ve `MAX_REVIEWS` dışa açılmaya devam eder: mevcut testler kullanıyor olabilir). `reviewCandidates`, `oldestCards`, `ensureDaily`'deki `live` kümesi ve `fresh` seçimi, `dailyCards`, `dailyQueue`, `rateDaily` içindeki `store.allCards()` → `daily.programCards(p)`. `store.data.program` → `daily.program()` (`beginDaily` ana programı oluşturmaya devam eder; `session.daily.deck = null` yapar).
- `startDailyStudy` ve `startDailyGame` `store.data.lastView`'e etkin kategori varsa `program: deck` yazar.
- Diğer dosyalardaki her `store.data.program` → `daily.program()`. İstisna: `view.js` `renderDaily()` ana ekran panelini çizer ve her zaman `store.data.program` / `ensureDaily(store.data.program)` kullanır; `renderDailyActions(target)` ise etkin programı kullanır (kartlar bitince meydan okumanın oyunları görünür).
- `lifecycle.js` `refreshDailyDay`: ana programı ve bütün meydan okumaları `ensureDaily(p)` ile yeni güne taşır; etkin görünüm günlükse ana ekrana döner (mevcut davranış).
- `navigation.showHome`: `session.daily.deck = null`.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: tüm testler PASS (58 eski + 6 yeni).

- [ ] **Step 5: Commit**

```bash
git add src/js tests/challenge.test.cjs
git commit -m "Run the daily scheduler on the active program"
```

---

### Task 2: Meydan okuma başlatma, bırakma ve tamamlanma

**Files:**
- Create: `src/js/features/daily/challenges.js`
- Modify: `index.html` (betiği `daily/lifecycle.js`'den sonra ekle)
- Modify: `src/js/features/daily/scheduler.js` (`registerMistake`)
- Modify: `src/js/bootstrap.js` (`lastView.program` ile geri yükleme)
- Test: `tests/challenge.test.cjs`

**Interfaces:**
- Consumes: `daily.program`, `daily.programCards`, `daily.ensureDaily(p)`, `daily.programDate`, `daily.REVIEW_DAYS` (Task 1).
- Produces:
  - `daily.startChallenge(deck: string): boolean` — kategori boşsa veya meydan okuması zaten varsa `false`. Program oluşturur (`start` = bugün, `dayIndex: 0`), ana programdaki bu kategorinin kart durumlarını taşır, ana programın bugünkü oturumunu `ensureDaily(store.data.program)` ile temizler, sonra `openChallenge(deck)`.
  - `daily.openChallenge(deck: string)` — `session.daily.deck = deck`, `renderDaily()` olmadan doğrudan `startDailyStudy()`.
  - `daily.leaveChallenge(deck: string)` — durumları ana programa geri taşır (ana program yoksa `{version:1,start:bugün,cards:{},session:null}` olarak oluşturur), `store.data.challenges[deck]`'i siler, etkin kategori buysa `session.daily.deck = null`, ana programın bugünkü oturumunu yeniden kurmaz (yarın havuza girer).
  - `daily.isComplete(deck: string): boolean` — kategorideki her kartın durumu `learned` ve `stage === REVIEW_DAYS.length - 1`.
  - `daily.challengeSummary(deck: string): string | null` — `'2. hafta, 3. gün · 10 yeni · 12 tekrar'` biçimi; meydan okuma yoksa `null`.

- [ ] **Step 1: Write the failing tests**

```js
test('starting a challenge moves the deck out of today\'s main session and keeps progress',()=>{
  const g=setup(30);g.begin();g.learn();
  g.run("S.decks.YDS=S.decks.Test.splice(0,15);");
  const before=g.value("S.program.cards['0']");
  assert.equal(g.run("startChallenge('YDS')"),true);
  assert.deepEqual(g.value("S.challenges.YDS.cards['0']"),before);
  assert.equal(g.run("S.program.cards['0']"),undefined);
  assert.ok(session(g).ids.every(id=>Number(id)>=15));
  assert.equal(g.value('program().session').newIds.length,0,'learned words are not new again');
});

test('leaving a challenge returns progress to the main program',()=>{
  const g=setup(20);g.run("S.decks.YDS=S.decks.Test.splice(0,10);startChallenge('YDS');while(program().session.pending.length)rateDaily('know');");
  g.run("leaveChallenge('YDS')");
  assert.equal(g.run('S.challenges.YDS'),undefined);
  assert.equal(g.run("S.program.cards['0'].learned"),true);
});

test('empty decks and running challenges cannot be started',()=>{
  const g=setup(5);g.run("S.decks.Empty=[]");
  assert.equal(g.run("startChallenge('Empty')"),false);
  assert.equal(g.run("startChallenge('Test')"),true);
  assert.equal(g.run("startChallenge('Test')"),false);
});

test('words added to a challenge deck later become new words',()=>{
  const g=setup(10);g.run("startChallenge('Test');while(program().session.pending.length)rateDaily('know');");
  g.run("S.decks.Test.push({id:'late',en:'late',tr:'geç',box:1,due:0})");g.day(1);g.run("openChallenge('Test')");
  assert.ok(g.value('program().session').newIds.includes('late'));
});

test('a challenge is complete when every word reached the last step',()=>{
  const g=setup(3);g.run("startChallenge('Test')");
  assert.equal(g.run("isComplete('Test')"),false);
  g.run("Object.values(S.challenges.Test.cards).forEach(s=>{s.learned=true;s.stage=REVIEW_DAYS.length-1;})");
  assert.equal(g.run("isComplete('Test')"),true);
});

test('a free study mistake demotes the word inside its challenge',()=>{
  const g=setup(3);g.run("startChallenge('Test');Object.values(S.challenges.Test.cards).forEach(s=>{s.learned=true;s.stage=2;})");
  g.run("Vocab.session.daily.deck=null;registerMistake('0')");
  assert.equal(g.run("S.challenges.Test.cards['0'].stage"),1);
});

test('a reload during a challenge reopens the same challenge',()=>{
  const g=setup(3);g.run("startChallenge('Test')");
  assert.deepEqual(g.value('S.lastView'),{type:'dailyStudy',program:'Test'});
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/challenge.test.cjs`
Expected: yeni testler FAIL (`startChallenge is not defined`).

- [ ] **Step 3: Implement**

- `challenges.js`: yukarıdaki beş fonksiyon. `challengeSummary` chip metinlerini `view.js`'deki hesapla aynı kurar (hafta = `cycleOf(p)+1`, gün = `dayIndex%7+1`).
- `registerMistake(id)`: `[store.data.program, ...Object.values(store.data.challenges || {})]` içinde `cards[id]`'i bulup `demote`.
- `bootstrap.js`: `dailyStudy`/`dailyGame` geri yüklenirken `lastView.program` varsa ve meydan okuma hâlâ duruyorsa önce `session.daily.deck = lastView.program`.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: tüm testler PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html src/js tests/challenge.test.cjs
git commit -m "Add per-category challenges"
```

---

### Task 3: Ana ekran, Öğrendiklerim paneli ve README

**Files:**
- Modify: `src/js/features/decks/decks.js`
- Modify: `src/js/features/progress/mastery.js`
- Modify: `src/styles/tools.css` (gerekirse `.challenge-summary` için küçük stil)
- Modify: `README.md` (yeni `## Kategori meydan okuması` bölümü, `## Zor kelimelerim`'den önce), `docs/architecture.md` (`daily/challenges.js` satırı)
- Test: `tests/challenge.test.cjs`, `tests/architecture.test.cjs` (`browser()` kalıbı)

**Interfaces:**
- Consumes: `daily.startChallenge`, `daily.openChallenge`, `daily.leaveChallenge`, `daily.isComplete`, `daily.challengeSummary` (Task 2).

- [ ] **Step 1: Write the failing tests**

```js
// tests/architecture.test.cjs
test('each category row offers a challenge and shows its progress once started', () => {
  const b = browser({ decks: { Test: [
    { id: 'a', en: 'abate', tr: 'azalmak', box: 1, due: 0 },
    { id: 'b', en: 'bolster', tr: 'desteklemek', box: 1, due: 0 }
  ], Empty: [] }, pts: 0, streak: 0, last: '', today: 0, cur: null });
  const row = name => b.elements.get('decks').children.find(el => el.querySelector('b').textContent === name);
  const button = (el, label) => el.children[1].children.find(x => x.textContent === label);
  assert.equal(button(row('Empty'), 'Meydan okuma').disabled, true);
  button(row('Test'), 'Meydan okuma').onclick();
  b.app.navigation.showHome();
  assert.ok(button(row('Test'), 'Devam et'));
  assert.ok(button(row('Test'), 'Meydan okumayı bırak'));
  assert.match(row('Test').querySelector('small').textContent, /1\. hafta, 1\. gün/);
});

// tests/challenge.test.cjs
test('deleting a category deletes its challenge', () => {
  const g=setup(3);g.run("startChallenge('Test');Vocab.decks.removeDeck('Test')");
  assert.equal(g.run('S.challenges.Test'),undefined);
});

test('mastery counts words from every program', () => {
  const g=setup(20);g.run("S.decks.YDS=S.decks.Test.splice(0,10);startChallenge('YDS');while(program().session.pending.length)rateDaily('know');");
  assert.equal(g.value('Vocab.progress.counts()').learning,10);
});
```

(`browser()` test yardımcısının `children`/`querySelector` desteği mevcut `hard words` testindeki kullanımla aynıdır.)

- [ ] **Step 2: Run to verify they fail**

Run: `npm test`
Expected: yeni testler FAIL.

- [ ] **Step 3: Implement**

- `decks.js`: kategori satırında (`deletable` olanlar) meydan okuma yoksa `Meydan okuma` (kart yoksa `disabled`); varsa `Devam et` → `openChallenge`, `Meydan okumayı bırak` → `confirm` sonrası `leaveChallenge` + `renderDecks`. Varsa `small` metnine ` · ` + `challengeSummary(name)` ve `isComplete` ise ` · Tamamlandı` eklenir. Silme mantığı `removeDeck(name)` fonksiyonuna taşınır (kategori ve `store.data.challenges[name]` silinir) ve dışa açılır.
- `mastery.js`: `level(card)` durumu ana program ve tüm meydan okumaların `cards` alanlarından arar; `counts` dışa açılır; panel herhangi bir program varsa görünür.
- README: davranış bölümündeki maddeler (10/30/40 sınırları, taşınan ilerleme, bırakma, tamamlanma).

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: tüm testler PASS.

- [ ] **Step 5: Manual check**

`index.html`'i tarayıcıda aç: bir kategoride `Meydan okuma` → 10 kart gelir; ana ekranda satır bilgisi görünür; ana programın kartları azalır; `Meydan okumayı bırak` sonrası satır eski hâline döner.

- [ ] **Step 6: Commit**

```bash
git add src README.md docs/architecture.md tests
git commit -m "Show category challenges on the home screen"
```
