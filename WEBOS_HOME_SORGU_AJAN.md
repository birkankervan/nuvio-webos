# PATCH-02 — Home DOM sorgu tekrarı

Cavecrew inceleyen: cave_home_review (Luna6/max); uygulayan: cave_home_builder
(Luna6/max). Root: kod incelemesi, plan, TV ölçümü/kurulum.

İnceleme: HomeDataWindow.markup odaklı düğümü bir kez bulur; rowWindow her
satırda odaklı ve genişlemiş düğümü tekrar sorgular. Gerçek TV'de 3 görünür
satır için durağan20sync:140 viewport sorgusu,20markup,0renderCard;29.2ms.
Zaman tek kısa tanılama ölçümüdür, FPS/kullanıcı gecikme kabulü değildir.

Apply: her markup geçişinde odak/genişleme snapshot'ı; rowWindow'a aktar,
genişleme genişliğini geçiş başına en çok bir kez oku. Kalıcı cache ekleme.
Skip: erken sync return/signature cache; resize, expansion, measurement,
focushandoff ve setRows dışı kaynak indeks değişimi riskleri nedeniyle.

PATCH-01 gerçekTV probe iki stable tekrarda15/15 geçti: unchanged-row0,
hero-only0, renderer/shell/focus/scroll korundu; mounted/cache24. İlk transient
scroll assertion tekrarlanmadı; anchor bug kanıtı sayılmadı.

Uygulama tamam: yalnız homeDataWindow.js ve yeni homeDataWindowQueries.test.mjs.
Builder Home32/32, root tümilgili41/41; lint, strictpackage/buildgraph/diffcheck
başarılı. Reviewer scoped diff sorunsuz. İzole gerçekTVfixture114/114 geçti.
Paket nuvio-lg-145'e kuruldu; kurulu20sync40query/20markup/0renderCard:
sorgu sayısı140→40, yaklaşık%71 azaldı. Başlangıç3row24card; yeni açılış2row13card.
Yeni sorgu sayısı satırdan bağımsız2; Node15row testi de2query doğrular. Zaman
29.2→17.3/23.4ms kısa gözlemdir; farklı working-set/FPS ölçümü sayılmaz.

Kalan ayrı kabul sorunu: kurulu açılışta dirty-row probe iki kez unchanged-row
assertion verdi (başlangıç13cache, diğer catalogrowIndex2 için8callback). Dirty
satır ölçümü silinince tahmini364px, tekrar ölçülünce392.1875px; pencere/geometri
geçici değişiyor. Sonraki probeda başlangıç scroll2395 olduğundan kumanda
etkileşimi olası; kontrollü nav/scroll kabulü sayılmadı. Sorgu snapshot değişikliği
bu reset yoluna dokunmaz. PATCH-01 tüm runtime kabulü kapanmış sayılmaz.
Sonraki iş: metadata-only dirty update ile geometri invalidation'ını ayıran
anlamlı repro/fix; gerçekTVfocus/scroll/working-set kabulü. Hero açık korunur.
