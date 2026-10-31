# Kategori meydan okuması — tasarım

Tarih: 2026-11-01

## Amaç

"2025 YDS", "2024 YDS" gibi sınav kategorileri için her kategoriye ayrı bir günlük program: günde 10 yeni kelime, mevcut 20 kelimelik programla aynı tekrar ve oyun kuralları.

## Kararlar

- Meydan okuması başlatılan kategorinin kelimeleri ana 20 kelimelik programdan çıkar. Her kelimenin tek bir tekrar takvimi olur.
- Ana programda çalışılmış kelimeler meydan okumaya basamak ve tekrar tarihleriyle taşınır, yeni kelime sayılmaz.
- Yeni kelimeler bitince meydan okuma tekrar günleriyle sürer. Bütün kelimeler `Öğrenildi` seviyesine gelince `Tamamlandı` olarak işaretlenir; 30 günlük tekrarlar gelmeye devam eder.
- Birden fazla kategorinin meydan okuması aynı anda sürebilir.

## Davranış

- Her kategori satırında `Meydan okuma` butonu bulunur; basılınca o kategorinin programı o gün başlar (1. hafta, 1. gün).
- Günlük kurallar ana programla aynıdır: 1–6. günler 10 yeni kelime, 7. gün genel tekrar, aralıklar 1, 3, 7, 14, 30 gün; kartlardan sonra Test, Eşleştirme, Cümle Tamamla zorunlu, Eş/Zıt Anlam Bul isteğe bağlı.
- Sınırlar: günde en çok 30 tekrar kartı, toplam en çok 40 kart. Tekrarlar 30'u aşarsa o gün yeni kelime açılmaz (ana programdaki birikme kuralı).
- Meydan okuması süren kategori satırında gün bilgisi (`2. hafta, 3. gün · 10 yeni · 12 tekrar`), `Devam et` ve `Meydan okumayı bırak` butonları görünür. Tamamlandıysa `Tamamlandı` etiketi eklenir.
- `Meydan okumayı bırak`: onay ister; kelime durumları ana programa geri taşınır (ana program yoksa oluşturulur), meydan okuma silinir.
- Meydan okuma sürerken kategoriye eklenen kelimeler yeni kelime olarak sıraya girer. Kategori silinirse meydan okuması da silinir.
- Puan, seri ve `Bugün` sayacı bütün programlarda ortaktır. `Öğrendiklerim` paneli bütün programların kelime durumlarını birlikte gösterir.
- Serbest çalışma ve serbest oyunlardaki hatalar, kelime hangi programdaysa orada bir basamak düşürür.

## Veri

- `store.data.program`: ana program, yapısı değişmez (geriye dönük uyumlu).
- `store.data.challenges`: `{ [kategoriAdı]: program }`. Her program ana programla aynı alanlara sahiptir (`version`, `start`, `dayIndex`, `cards`, `session`, `lastSessionDay`) ve ek olarak `deck` alanını taşır.
- `store.data.lastView`: günlük çalışma ve günlük oyun görünümlerinde açık programın kategori adını `program` alanında saklar (ana program için yok).

## Kod

- `daily/scheduler.js`
  - `daily.program()`: açık programı döndürür (oturumdaki etkin kategori adına göre `store.data.challenges[ad]`, yoksa `store.data.program`).
  - `daily.programCards(p)`: ana program için meydan okuması olan kategoriler dışındaki kartlar; meydan okuma için `store.data.decks[p.deck]`.
  - `daily.limits(p)`: `{ newPerDay, maxReviews, maxDayCards }` → ana program 20/60/80, meydan okuma 10/30/40.
  - `ensureDaily`, `reviewCandidates`, `oldestCards`, `dailyCards`, `dailyQueue`, `rateDaily`, `dailyMistake`, `advanceDailyDay` bu yardımcıları kullanır; şu an `store.allCards()` kullanılan program içi yerler havuzla değiştirilir.
  - `registerMistake(id)`: kelimenin durumunu tüm programlarda arar.
- `store.data.program` doğrudan kullanan yerler `daily.program()` kullanır: `daily/games.js`, `daily/view.js`, `daily/lifecycle.js`, `games/sentence.js`, `study/study.js`, `words/editor.js`.
- Yeni `daily/challenges.js`: `startChallenge(deck)`, `openChallenge(deck)`, `leaveChallenge(deck)`, `isComplete(deck)`, `challengeSummary(deck)`.
- `decks/decks.js`: kategori satırında butonlar ve gün bilgisi; kategori silinince `store.data.challenges[ad]` silinir.
- `progress/mastery.js`: bütün programların `cards` durumlarını birleştirir.
- `index.html`: yeni betik dosyası yüklenir.
- Ana ekrandaki günlük program paneli her zaman ana programı gösterir; meydan okumadan dönünce etkin program ana programa döner.

## Test

Yeni `tests/challenge.test.cjs`:

- Başlatınca ilk gün 10 yeni kelime açılır; 7. gün yeni kelime gelmez.
- Kategorinin kelimeleri ana programın oturumundan ve yeni kelime havuzundan çıkar.
- Ana programdaki ilerleme meydan okumaya, bırakınca geri taşınır.
- Kategoriye sonradan eklenen kelime sıraya girer; kategori silinince meydan okuma silinir.
- Tüm kelimeler öğrenilince `isComplete` doğru döner.
- Serbest çalışma hatası meydan okumadaki kelimeyi bir basamak düşürür.

Mevcut testlerin hepsi değişmeden geçmelidir (ana program davranışı aynı kalır).
