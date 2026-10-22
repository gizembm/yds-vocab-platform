# Mimari ve geliştirme rehberi

Bu proje derleme gerektirmeyen bir tarayıcı uygulamasıdır. `index.html`, ekran
iskeletini ve dosyaların yükleme sırasını içerir. Oyun kuralları ve mevcut kayıt
biçimi, kodun özelliklere ayrılması sırasında korunmuştur.

## Başlangıç ve modül modeli

Dosyalar klasik `<script>` etiketleriyle şu sırada yüklenir:

1. PapaParse: mevcut CSV ayrıştırıcısı.
2. `core/config.js`: tek global ad alanı olan `globalThis.Vocab` nesnesi.
3. Diğer `core/` dosyaları: yardımcılar, kalıcı veri ve geçici oturum durumu.
4. `features/` dosyaları: özelliklerin tanımları ve dışarı açtıkları işlemler.
5. `bootstrap.js`: DOM olaylarını bağlar, ana ekranı çizer ve varsa son karta döner.

Her özellik kendi IIFE kapsamındadır. Dosya içindeki değişken ve fonksiyonlar
kendiliğinden globale çıkmaz; dışarı açılan işlemler dosyanın sonundaki
`Object.assign` çağrısında görülür. Dosyanın başındaki ad alanı bağlantıları
bağımlılıklarını açıkça gösterir. Özelliklerin birbirini çağırması, bütün
tanımlar yüklendikten sonra gerçekleşir. Gün değişimi modülü yüklenirken ilk
tarihi hesaplar; bu yüzden günlük planlayıcıdan sonra yüklenmelidir.

ES module ve `fetch` tabanlı dinamik yükleme kullanılmaz; böylece mevcut
`file://` üzerinden açılış korunur. Yeni modül eklerken HTML'deki sıraya açıkça
eklemek gerekir. Klasörleri tarayan otomatik bir çalışma zamanı yükleyicisi yoktur.

## Veri ve sorumluluklar

| Alan | Görevi |
| --- | --- |
| `Vocab.config` | Kayıt anahtarı, gün uzunluğu ve serbest Leitner aralıkları |
| `Vocab.utils` | DOM öğesi bulma, İstanbul tarih biçimi, karıştırma |
| `Vocab.store` | Kalıcı `data`, `save()`, kategori ve kart sorguları |
| `Vocab.session.study` | Etkin kategori, çalışma kuyruğu, kart konumu ve günlük çalışma bayrağı |
| `Vocab.session.play` | Oyun modu, kapsamı, geçici kuyruklar, seçimler ve zamanlayıcılar |
| `Vocab.decks` | Kategori ekleme/listeleme/silme ve istatistik çizimi |
| `Vocab.importer` | CSV/XML okuma, tekrarlı satır kontrolü ve yükleme raporu |
| `Vocab.study` | Kart çizimi, kart geçişleri ve serbest çalışma puanlaması |
| `Vocab.navigation` | Ana ekran/oyun ekranı geçişleri ve zamanlayıcı temizliği |
| `Vocab.matching`, `Vocab.quiz`, `Vocab.sentence` | Serbest oyunlar; günlük modda günlük programla bağlantı |
| `Vocab.daily` | Günlük programın planlama, görünüm, oyun ve gün değişimi işlemleri |
| `Vocab.audio` | Tarayıcı seslendirme işlemi |

`store.data`, önceki `S` nesnesinin yerini alır. `localStorage` anahtarı hâlâ
`flashcards_v1` değeridir. Kategoriler, puanlar, seri, son kart ve `program`
ilerlemesi aynı biçimde saklanır; bu düzenleme için veri göçü gerekmez.
Veriyi değiştiren işlem, gerekli güncellemelerden sonra `store.save()` çağırır.

Geçici çalışma kuyrukları ve zamanlayıcılar `session` içinde tutulur ve kayda
yazılmaz. Günlük programın yenilemede ve gün değişiminde devam etmesi gereken oturum/gün sayacı bilgilerini ise
`store.data.program.session` içinde; gün sayacı `store.data.program.dayIndex` alanındadır. Bu iki oturum alanını birbirine karıştırma.

Günlük program dört dosyaya ayrılır:

- `scheduler.js`: İstanbul tarihi, yeni kelime kotası, tekrar aralıkları,
  günlük kart çalışması ve unutulan kartın programa geri alınması.
- `view.js`: günlük program özeti ve oyun düğmeleri.
- `games.js`: test, eşleştirme, cümle, eş ve zıt anlam turları; ilerleme ve yeniden başlatma.
- `lifecycle.js`: tarih değişimini algılama; olay ve aralık bağlantıları
  `bootstrap.js` içinde yapılır.

Serbest Leitner kutuları ile günlük programın öğrenme durumu ayrı tutulur.
Oyun ekranından çıkarken bekleyen zamanlayıcıları temizleme davranışı korunmalıdır.

## Bir özelliği değiştirme veya ekleme

1. Özelliğe en yakın `features/` klasörünü seç. Ortak altyapıyı `core/` içinde,
   yalnızca o özelliğe ait davranışı özellik dosyasında tut.
2. Bağımlılıklarını dosyanın başında `globalThis.Vocab` üzerinden al; yalnızca
   kullanılan ad alanlarını ekle. Modül içinde `store.data` güncel kaynağıdır.
3. Diğer dosyaların çağıracağı işlemleri özelliğin ad alanında dışarı aç.
   Kalıcı veriyi değiştirdiğinde mevcut kayıt sözleşmesini koru.
4. Yeni dosyayı `index.html` içinde çekirdekten sonra, `bootstrap.js` dosyasından
   önce yükle. Başlangıçta gereken bağımlılıklar daha önce yüklenmelidir.
5. Statik DOM olaylarını `bootstrap.js` içinde bağla. Dinamik oluşturulan
   kategori/cevap düğmelerinin olayları ilgili çizim fonksiyonunda kalır.
6. Stilleri uygun özellik stiline ekle. Tema renkleri `tokens.css`, ortak
   kontroller `base.css`, mobil ve hareket tercihleri `responsive.css` içindedir.
7. Davranış testini ilgili test dosyasına ekle ve `npm test` çalıştır.

Örnek modül yapısı:

```js
(() => {
  'use strict';

  const { store, sentence } = globalThis.Vocab;

  function exampleAction() {
    return store.allCards();
  }

  Object.assign(sentence, { exampleAction });
})();
```

Bu örnek yalnızca modül desenini gösterir; gerçek oyun arayüzünü başlatmaz.
Renk ve yerleşim değişiklikleri için JavaScript'e tema değerleri ekleme.

## Testler ve uyumluluk

`npm test` veya `node --test tests/*.test.cjs` komutu Node.js'in yerleşik test
çalıştırıcısını kullanır. Paket kurulumu veya ek test kütüphanesi gerekmez.

Test yükleyicisi script listesini doğrudan `index.html` üzerinden okur; böylece
tarayıcı ve test sıralaması ayrı listelerden yönetilmez. Eski davranış testlerinin
kısa adları, yalnızca test ortamındaki getter/setter bağlantılarıyla yeni
ad alanlarına yönlendirilir. Üretim kodu bu bağlantıları yüklemez.

Mimari testleri gerçek başlangıcı bu kısa ad bağlantıları olmadan çalıştırır;
dosya yollarını, stil girişini, tek global ad alanını, kontrol bağlantılarını ve
eski kayıttan son karta dönüşü doğrular. Oyun testleri hataların tekrarı,
puanlama, günlük kota, kayıt devamlılığı ve gün değişimini kapsar.

DOM testleri tarayıcının görsel yerleşimini ölçmez. Görsel bir değişiklikte
`index.html` üzerinden masaüstü ve mobil görünümü ayrıca kontrol et.
