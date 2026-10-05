> Tarihsel ara optimizasyon planı. Yerine geçen plan: [nihai mimari](2026-10-05-webos-nihai-mimari.md). Tamamlandı olarak işaretlenmiş işler nihai sanallaştırmanın tamamlandığı anlamına gelmez.

# webOS performans çalışma planı

## Sıra

1. Kaynak incelemesi, cihaz bilgisi ve ölçüm senaryosu: tamamlandı; boşta ve gezinme için ilk gerçek cihaz baseline alındı.
2. Home hot-path, stream batch/keyed render/lifecycle ve lazy route/build düzeltmeleri uygulandı; yerel test/lint/build/paket başarılı, tam uygulama TV A/B doğrulaması bekliyor.
3. Home Modern/Classic dikey satır penceresi uygulandı ve TV tarayıcısında izole DOM testi geçti. Yatay kart penceresi de eklendi. Veri üzerinden remount ve Grid bekliyor.
4. Uygulama açılışı ve video ilk-kare/ekran geçişi profiling; ardından See All, Library ve Search için aynı yaklaşımın gerektiği yerler.
5. Gerçek LG TV'de karşılaştırma ve regresyon kontrolü.
6. Performans aşaması doğrulandıktan sonra IPTV (Xtream/M3U/EPG).

## Home sanallaştırması tasarımı

### Önce odak modelini düzelt

- Odak kimliği: `rowKey + itemIdentity + logicalItemIndex`.
- `navCol`, `captureCurrentFocusState`, `captureFocusStateForNode`,
  `restoreFocusState`, `restoreModernFocusState`, `rememberMainRowFocus` ve
  hold-menu seçimleri mounted DOM sırasına bağımlı olmamalı.
- D-pad hedefini veri modelinden belirle; hedef pencereyi mount ettikten sonra
  DOM odağını ve scroll'u uygula. Sonraki satırın hedefi henüz DOM'da değilken
  de navigasyon çalışmalı.
- Geri dönüşte 200. kart için ilk 201 kartı mount etmek yerine 200 çevresindeki
  pencereyi mount et. Identity ile eşleştirmeyi koru.

### Sonra iki eksende pencere uygula

- Dikeyde görünür satırlar ve küçük overscan bölgesi; uzak satırların alanını
  ölçülmüş yükseklik/spacer ile koru. İlk aday: aktif satır, üstte bir ve altta
  iki satır; gerçek viewport daha fazla gösteriyorsa görünür satırları koru.
- Yatayda görünür kartlar ve her iki tarafta yaklaşık beş kart overscan.
  Poster ölçülerini mevcut sizing ayarlarından al; CW kartı ile poster
  genişliğini aynı varsayma.
- Spacer hesabına gap, track padding ve genişleyen poster boyutunu dahil et.
- Odaklanan kartı pencere değişiminde çıkarma; sadece giren/çıkan kartları
  güncelle. Her tuşta track `innerHTML` değişimi yapma.
- Pagination API'deki `skip/nextSkip` için veri sayısını kullan; mounted kart
  sayısını kullanma. Koleksiyon satırlarını da pencereye dahil et.
- Görsel hydration indexini pencere değişiminde güncelle; çıkmış kartları,
  trailer/GIF kaynaklarını ve timer'ları temizle.
- Magic Remote hover/wheel, uzun basma, sidebar, hızlı dikey kaydırma ve
  detail'dan geri dönüş aynı mantıksal odağı korumalı.

## Kabul ölçütleri

- Toplam katalog verisi arttığında mounted kart sayısı görünür pencere ve
  overscan bütçesinde kalır. 20×100 veri senaryosunda 2.000 kart DOM'a girmez.
- Satırın sonuna kadar sağa, sonra başına kadar sola gidilebilir; eksik/tekrar
  kart, odak kaybı ve yanlış API skip oluşmaz.
- Collection ve split Upcoming/CW listesi bu sınırı bypass etmez.
- 200. kartta detail açıp geri dönmek aynı karta ve scroll konumuna döner.
- Ana sayfa timer/event/trailer kaynaklarını route değişiminde bırakmaz.
- Aynı TV, hesap ve senaryoda önce/sonra frame süresi ve giriş gecikmesi
  karşılaştırılır. Masaüstü tarayıcı sonucu TV sonucu diye raporlanmaz.

## Kapsam sınırı

Mevcut auth, addon, profil/senkronizasyon, player ve native webOS servisleri
korunacak. Bu ilk aşamada React, Zustand veya yeni bir virtualization paketi
eklenmeyecek. IPTV bu doğrulama tamamlanmadan eklenmeyecek.

## İlk düzeltmelerin etkisi ve sınırı

Modern TV'de son D-pad girişinden 250 ms sonrasına kadar Home arka plan render
bekletiliyor. Eski TV tekrar limitinin erişilemeyen koşulları düzeltildi. Legacy
görsel kuyruğu Map ile tekilleştiriliyor. Focus hot-path debug argümanları yalnız
debug açıkken hesaplanıyor. Yeni bağımlılık eklenmedi.

Eski TV limit/kuyruk düzeltmeleri kullanıcının Chromium 132 modern profiline
doğrudan fayda sağlamaz. Bu TV için esas takip işi DOM sanallaştırması ve
profiling'dir; mevcut değişiklikler 267 ms frame gecikmesini çözmüş kabul edilmiyor.

## Güncel uygulama kaydı

Dosya kapsamı, lifecycle bulguları, çözümler ve test sonuçları için
[WEBOS_DERIN_INCELEME.md](WEBOS_DERIN_INCELEME.md). Yukarıdaki iki eksenli
kabul ölçütleri nihai hedef; iki eksenli DOM cache katmanı heap bütçesini
karşılıyor kabul edilmemeli.
