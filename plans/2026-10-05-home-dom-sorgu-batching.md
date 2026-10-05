# PATCH-02 — Home DOM sorgularını birleştirme

Sahip builder: cave_home_builder (Luna6/max). Read-only inceleme:
cave_home_review (Luna6/max). Root entegrasyon ve TV kabulü.

1. Tamam: R-05 çağrı hattı doğrulandı. Her markup'ta focused sorgusu bir kez,
   her görünür satırda expanded/focused tekrar sorgulanıyor (1+2N).
2. Tamam: kuruluTV20durağansync/3row:140query,20markup,0renderCard baseline.
   Önceki PATCH01 actualprobe iki stable tekrarda15/15 geçti.
3. Uygulama: markup geçişinde focused/expanded birer sorgu, genişlik en çok
   bir okuma; rowWindow bu context'i kullanır. Geçişler arası DOM cache yok.
4. Test: sorgu sayısı satır sayısından bağımsız; expanded yerleşim ve extent,
   eski fokusun geçişte tutulması, viewport yokken ilk markup korunur.
5. Root review: yalnız scoped baseline diff; dirty geçmişi ve prefs koru.
6. Doğrulama: ilgili Node/lint/strict paket/buildgraph; gerçekTVfixture ve
   kurulu gerçekHome querysayımı + reversible PATCH01 kabulü.
7. Rapor ve checkpoint: actual before/after, test ve kalan backlog kaydedilir.

Kapsam dışı: full sync cache, ölçüm atlama, anchor varsayımı, navigasyon yeniden
mimarisi, diğer ekranlar. Hero açık kullanıcı tercihi ve TMDB/native player
ayarları korunur. Ölçülen sorgu azalması FPS garantisi diye sunulmaz.

Son durum: PATCH-02 sorgu batching tamam ve TV'de40/20sync doğrulandı;
41test/lint/package ve114izoleTVkontrol geçti. PATCH-01 ölçüm resetinden doğan
geçici working-set/scroll sapması ayrı açık; tüm Home kabulü tamamlanmadı.
