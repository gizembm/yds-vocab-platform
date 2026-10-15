# YDS Vocabulary Platform

CSV veya XML ile kelime listesi yukleyip calisma kartlari, eslestirme ve soru-cevap oyunlariyla pratik yapmaya yarayan basit bir web uygulamasi.

## Ozellikler

- Kategori bazli kelime listesi
- CSV, XML ve TXT dosya aktarimi
- Leitner mantigiyla tekrar kartlari
- Telaffuz destegi
- Eslestirme oyunu
- Coktan secmeli soru-cevap oyunu
- Tarayicida localStorage ile veri saklama

## Kullanim

`index.html` dosyasini tarayicida acman yeterli.

Dosya yuklerken sutun sirasi:

```text
Kategori, Ingilizce Kelime, Turkce Karsiligi, Ornek Cumle, Cumle Cevirisi, Ipucu
```

## Günlük 20 kelime programı

Kelime listesini yükledikten sonra **Programı başlat** düğmesine bas. Başladığın
gün 7 günlük döngünün ilk günüdür: ilk 6 gün 20 yeni kelime açılır; 7. gün
yeni kelime eklenmeden döngünün tamamı tekrar edilir. Çalışma listesi hafta
boyunca 20, 40, 60, 80, 100 ve 120 kelime olarak birikir. Kaçırdığın günlerin
yeni kelimeleri birikmez. Gün sınırı Türkiye saatine göre hesaplanır.

Kartları çevirip **Bilemedim**, **Zorlandım** veya **Öğrendim** seçeneğini kullan.
Öğrenmediğin kart iki başka karttan sonra yeniden gelir. Günün bütün kartlarını
tamamlayınca aynı kelimelerle **Test** ve **Eşleştirme** turları açılır. Oyunlardaki
yanlışlar yeniden kart çalışmasına döner; doğru oyun cevabı kartı öğrenilmiş saymaz.

Eski döngülerden öğrenilmeyenler her gün gelir. Öğrenilen kelimeler 1, 3, 7, 14
ve 30 günlük aralıklarla tekrar edilir; sonrasında 30 gün arayla devam eder.
Kelime havuzu tükenirse tekrarlar sürer. Sonradan yüklenen kelimeler sonraki
yeni kelime gününde programa alınır. Serbest kategori çalışması ve oyunlar
günlük programdan bağımsız kullanılabilir.

Program, kartlar ve oyun ilerlemesi aynı tarayıcının `localStorage` alanında
saklanır. Sayfayı yenilemek günlük kotayı değiştirmez. Tarayıcı verilerini
silmek bu ilerlemeyi de siler.

Testleri çalıştırmak için (Node.js):

```text
node --test matching.test.cjs daily.test.cjs
```
