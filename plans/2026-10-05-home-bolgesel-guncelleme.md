# PATCH-01 — Modern Home bölgesel güncelleme

Sahip: Luna 6 (`gpt-6-luna`), max. İnceleme ve TV kabulü: root.
Mevcut kirli değişiklikler korunacak; React veya yeni bağımlılık eklenmeyecek.

1. Akışı izle: requestBackgroundRender/requestRender, katalog chunk, CW/upcoming,
   hero enrichment, pagination ve watched/settings değişimleri. Her değişimin
   dokunduğu veri ve DOM bölgesini haritala; önce kapsamını root'a bildir.
2. İlk mount, route/Back restore, layout/settings değişimi ve loading-shell geçişi
   tam render yolunu korusun. Normal Modern veri gelişinde mevcut renderer,
   viewport, sidebar ve hero kabuğunu yeniden oluşturma.
3. Veri commit'i mevcut HomeDataWindow'a uygulansın. Mantıksal kimlik, kaynak
   indeksi, ölçüm kayıtları, track scroll, focus, listeners ve pending pagination
   sahipliği korunsun. Reorder/remove/loading dönüşümü güvenli fallback alsın.
4. Yalnız etkilenen görünür satırın kart markup'ını üret. Değişmeyen görünür
   satırlar ile görünmeyen kartların markup'ını tekrar üretme. Cache varsa
   yalnız güncel/mounted pencereyle sınırlı olsun; raw mutable veri referansı
   tek invalidation ölçütü olmasın. Row index, görsel ayar/watched state ve
   genişleme/ölçüm değişimlerinin invalidation'ını açık tut.
5. Hero değişimi yalnız hero patch'ini kullansın. Katalog değişimi sidebar
   teardown/rebind yapmasın. CW/upcoming güncellemesi yalnız bu satırları
   ve gerekirse dikey konumları değiştirsin. Odak değişmeden yeni veri gelsin.
6. Anlamlı test: gerçek Home render girişinde katalog değişimi aynı renderer
   ve shell'i korur; değişmeyen satırda renderCard çağrısı 0; CW/hero/reorder/
   removal ve pending pagination/route departure kontrol edilir. Gerçek DOM
   fixture'da düğüm kimliği, scroll/focus, bounded cache/listener ve cleanup
   doğrulanır. Mevcut 36 Node ve 77/21/17 DOM kontrolleri korunur.
7. Root kodun tüm değişikliklerini ve çağıranları inceler. Hatalı/gereksiz
   yaklaşım ajan tarafından yeniden yazılır. Son test/lint/paket sonrası TV'ye
   kurulur; gerçek uygulamada renderer/shell identity ve navigasyon doğrulanır.

Dosya sınırı: Home kaynak/test dosyaları ve performance-data-window-check.js
ajan sahibi. Shared keyedDomUpdate veya başka ekranlara edit gerekirse önce
root ile koordinasyon. Root plan/takip/checkpoint ve TV işlemleri sahibi.
Ajan özel raporu WEBOS_BOLGESEL_GUNCELLEME_AJAN.md; context daralması öncesi
son adım, değişen dosyalar, testler ve riskler kaydedilir.

Kabul: normal Modern veri gelişinde full shell üretimi ve renderer replacement
yok; değişmeyen satırda kart markup üretimi yok; odak/scroll/pagination ve
yeni verinin görünürlüğü korunur. Sadece mock testi runtime kabulü sayılmaz.


Güncel kabul durumu: 1–6 uygulandı, root source review/rewrite ve 39 Node/lint/
paket/buildgraph kontrolleri geçti; izole TV fixture114/114. Adım7 kurulum
başarılı fakat gerçek Home probe'daki unchanged-row yeniden çizimi araştırılacak.
Son tanılama kullanım limiti nedeniyle otomatik onay denetiminde çalıştırılamadı.
Bu plan tamamlandı sayılmaz; devam checkpoint26 içinde.
