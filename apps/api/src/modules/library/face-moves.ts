// Yüz Egzersizi ve Masajlar: bölgeye göre (alın, göz çevresi, yanak, çene hattı, gıdı ve boyun, dudak, tüm yüz) egzersiz ve masaj hareketleri.
// UYARI: Yüz egzersizi ve masajının etkisi için bilimsel kanıt sınırlıdır; sonuç garanti edilmez (hareket sayfasında sabit uyarı vardır).
// Kaynak taraması yapılmamıştır (karar: içerik sonradan incelenir); arayüzde "Henüz taranmadı" etiketi görünür.
import type { LibraryItem, Work } from './catalog.js';

export type FaceRegion = 'face-alin' | 'face-goz' | 'face-yanak' | 'face-cene' | 'face-gidi' | 'face-dudak' | 'face-tum';
export type FaceType = 'ex' | 'ms';

export const FACE_REGIONS: { key: FaceRegion; title: string }[] = [
  { key: 'face-alin', title: 'Alın' },
  { key: 'face-goz', title: 'Göz ve kaş çevresi' },
  { key: 'face-yanak', title: 'Yanak' },
  { key: 'face-cene', title: 'Çene hattı' },
  { key: 'face-gidi', title: 'Gıdı ve boyun' },
  { key: 'face-dudak', title: 'Dudak ve ağız çevresi' },
  { key: 'face-tum', title: 'Tüm yüz' },
];

const BASE = 'Temiz ellerle uygula; cildin hassassa, yüzünde yara, enfeksiyon ya da yeni botoks/dolgu varsa uygulama.';
const SOFT = 'Cildi çekme ve sert bastırma; hafif dokunuş yeterli.';
const JAW = 'Çene eklemi (TME) sorunun ya da çene ağrın varsa yapma; çenede ağrı olursa dur.';
const NECK = 'Boynun yanındaki damarlara bastırma; baş dönmesi olursa dur.';

const reps = (sets: number, n: number, rest: number): Work => ({ sets, reps: n, restSec: rest });
const time = (seconds: number, rest = 0, sets = 1): Work => ({ sets, seconds, restSec: rest });

interface Row {
  item: LibraryItem;
  region: FaceRegion;
  type: FaceType;
  en: string;
}
const ROWS: Row[] = [];

// id, başlık, İngilizce, bölge, tür, yapılış, adımlar, ek uyarı (varsa)
function f(id: string, title: string, en: string, region: FaceRegion, type: FaceType, work: Work, steps: string[], extra?: string) {
  ROWS.push({
    region,
    type,
    en,
    item: {
      id: `face-${id}`,
      kind: 'FACE',
      category: 'face',
      title,
      summary: `${FACE_REGIONS.find((r) => r.key === region)!.title} · ${type === 'ex' ? 'Egzersiz' : 'Masaj'}`,
      level: 'beginner',
      equipment: 'Ekipmansız',
      primary: [FACE_REGIONS.find((r) => r.key === region)!.title],
      secondary: [],
      steps,
      mistakes: [type === 'ms' ? 'Cildi sert çekmek ya da bastırmak' : 'Yüzü gereğinden fazla zorlamak'],
      warnings: [BASE, ...(type === 'ms' ? [SOFT] : []), ...(extra ? [extra] : [])],
      work,
    },
  });
}

// ───────── Alın ─────────
f('kas-kaldir', 'Kaşları kaldırma', 'Eyebrow raise', 'face-alin', 'ex', reps(2, 10, 10), ['Rahat otur, yüzün gevşek.', 'Kaşlarını mümkün olduğunca yukarı kaldır, alın kaslarını hisset.', '2 saniye tut, yavaşça bırak.']);
f('alin-destekli-kas', 'Alın desteği ile kaş kaldırma', 'Brow lift with finger support', 'face-alin', 'ex', reps(2, 10, 10), ['Parmaklarını kaşların hemen üstüne hafifçe koy.', 'Kaşlarını yukarı kaldırırken parmaklarınla hafif direnç ver.', 'Kontrollü bırak.']);
f('sasirmis-bakis', 'Şaşkın bakış tutma', 'Surprised look hold', 'face-alin', 'ex', time(15, 10, 2), ['Gözlerini ve kaşlarını geniş aç.', 'Alnını gererek 15 saniye tut.', 'Yüzünü yavaşça gevşet.']);
f('kas-cat-ac', 'Kaş çatma ve açma', 'Brow furrow and release', 'face-alin', 'ex', reps(2, 10, 10), ['Kaşlarını yavaşça çat.', 'Sonra tamamen gevşet, alnı düzleştir.', 'Yavaş ve kontrollü tekrarla.']);
f('alin-gevset', 'Alın gevşetme', 'Forehead relaxation', 'face-alin', 'ex', time(30), ['Gözlerini kapat.', 'Alnındaki gerginliği bırak, kaşlar rahat dursun.', 'Derin nefes al ve ver.']);
f('alin-yana-siva', 'Alını yana sıvazlama', 'Forehead outward strokes', 'face-alin', 'ms', time(45), ['Parmak uçlarını alnının ortasına koy.', 'Hafifçe yanlara, şakaklara doğru kaydır.', 'Yavaş ve düzenli tekrarla.']);
f('alin-yukari-siva', 'Alını yukarı sıvazlama', 'Forehead upward strokes', 'face-alin', 'ms', time(45), ['Kaş hizasından başla.', 'Parmak uçlarınla saç çizgisine doğru hafifçe kaydır.', 'Sırayla iki elle tekrarla.']);
f('sakak-daire', 'Şakak daire masajı', 'Temple circles', 'face-alin', 'ms', time(40), ['İki elin işaret ve orta parmaklarını şakaklara koy.', 'Küçük, yavaş daireler çiz.', 'Önce bir yöne, sonra diğer yöne.']);
f('kas-arasi', 'Kaş arası masajı', 'Glabella massage', 'face-alin', 'ms', time(30), ['Parmak ucunu iki kaş arasına koy.', 'Çok hafif, küçük daireler çiz.', 'Gerginliği bırak.']);
f('sac-cizgisi', 'Saç çizgisi masajı', 'Hairline press', 'face-alin', 'ms', time(40), ['Parmak uçlarını saç çizgisine koy.', 'Hafifçe bastır ve küçük daireler çiz.', 'Alından başlayıp kulaklara doğru ilerle.']);

// ───────── Göz ve kaş çevresi ─────────
f('goz-kirp', 'Göz kırpma serisi', 'Blinking series', 'face-goz', 'ex', reps(2, 15, 10), ['Gözlerini yavaşça kapat.', 'Hızlıca aç ve kırp.', 'Düzenli tekrarla.']);
f('goz-sik-ac', 'Gözü sıkma ve açma', 'Eye squeeze and open', 'face-goz', 'ex', reps(2, 10, 10), ['Gözlerini sıkıca kapat.', '2 saniye tut.', 'Sonra geniş aç.']);
f('goz-daire', 'Göz daireleri', 'Eye circles', 'face-goz', 'ex', reps(2, 8, 10), ['Başın sabit, gözlerini yavaşça saat yönünde çevir.', 'Sonra ters yönde.', 'Gözlerini zorlama; baş dönmesinde dur.']);
f('goz-yukari-bak', 'Yukarı bakarak kaş kaldırma', 'Look up brow lift', 'face-goz', 'ex', reps(2, 8, 10), ['Yukarı bak.', 'Kaşlarını kaldırıp 3 saniye tut.', 'Gevşet.']);
f('goz-cevresi-tap', 'Göz çevresi hafif vurma', 'Eye area tapping', 'face-goz', 'ex', time(30), ['Yüzük parmağının ucuyla göz çevresine hafifçe vur.', 'Göz kenarından başla, kaş altına doğru ilerle.', 'Çok hafif tut.']);
f('goz-alti-siva', 'Göz altı sıvazlama', 'Under-eye strokes', 'face-goz', 'ms', time(40), ['Yüzük parmağını göz altının iç köşesine koy.', 'Çok hafifçe dışa, şakağa doğru kaydır.', 'Cildi çekme.']);
f('kas-kemigi', 'Kaş kemiği masajı', 'Brow bone massage', 'face-goz', 'ms', time(40), ['Baş parmağını kaş kemiğinin altına koy.', 'Hafifçe bastırıp içten dışa kaydır.', 'Göz küresine bastırma.']);
f('goz-kenari', 'Göz kenarı hafif masaj', 'Outer eye massage', 'face-goz', 'ms', time(30), ['Göz dış köşesine parmak ucunu koy.', 'Çok hafif daireler çiz.', 'Yavaş tekrarla.']);
f('burun-koku', 'Burun kökü masajı', 'Nose bridge massage', 'face-goz', 'ms', time(30), ['İşaret parmağını burun kökünün yanına koy.', 'Hafifçe aşağı yukarı kaydır.', 'Nefesini düzenli tut.']);
f('goz-cevresi-daire', 'Göz çevresi dairesel masaj', 'Eye contour circles', 'face-goz', 'ms', time(40), ['Parmak uçlarıyla göz çevresinde yarım daire çiz.', 'Alt kısımda çok hafif, üst kısımda orta hafiflikte ol.', 'Ağır basınç uygulama.']);

// ───────── Yanak ─────────
f('yanak-sisir', 'Yanakları şişirme', 'Cheek puff', 'face-yanak', 'ex', time(20, 10, 2), ['Ağzını kapat, yanaklarına hava doldur.', '20 saniye tut.', 'Havayı yavaşça bırak.']);
f('hava-aktar', 'Havayı sağa sola aktarma', 'Air shift', 'face-yanak', 'ex', reps(2, 10, 10), ['Yanaklarına hava doldur.', 'Havayı sağ yanağa, sonra sola aktar.', 'Yavaş yap.']);
f('genis-gulumse', 'Geniş gülümseme tutma', 'Wide smile hold', 'face-yanak', 'ex', time(15, 10, 2), ['Dudaklarını kapalı tut.', 'Yanak kaslarını yukarı çekerek gülümse.', '15 saniye tut.']);
f('balik-surati', 'Balık suratı', 'Fish face', 'face-yanak', 'ex', reps(2, 10, 10), ['Yanaklarını içe çek, dudakların balık gibi büzülsün.', 'Gülümsemeye çalış.', '5 saniye tut, bırak.']);
f('o-yanak-kaldir', '“O” ile yanak kaldırma', 'O-shape cheek lift', 'face-yanak', 'ex', reps(2, 10, 10), ['Ağzını “O” şeklinde aç.', 'Yanak kaslarını yukarı kaldır.', 'Dişlerini örtmeye çalış, tut ve bırak.']);
f('yanak-destekli-gulumse', 'Parmak destekli gülümseme', 'Supported smile', 'face-yanak', 'ex', reps(2, 10, 10), ['Parmaklarını yanak üstüne hafifçe koy.', 'Gülümseyerek yanak kaslarını yukarı it.', 'Hafif direnç ver, kontrollü bırak.']);
f('yanak-yukari', 'Yanak yukarı sıvazlama', 'Cheek upward strokes', 'face-yanak', 'ms', time(45), ['Parmak uçlarını ağız köşesine koy.', 'Hafifçe elmacık kemiğine doğru kaydır.', 'Yukarı yönlü tekrarla.']);
f('elmacik-daire', 'Elmacık kemiği daire masajı', 'Cheekbone circles', 'face-yanak', 'ms', time(45), ['Parmak uçlarını elmacık kemiğine koy.', 'Küçük yavaş daireler çiz.', 'Kulağa doğru ilerle.']);
f('yanak-yogur', 'Yanak yoğurma', 'Gentle cheek kneading', 'face-yanak', 'ms', time(40), ['Parmaklarınla yanağı çok hafif tut.', 'Yavaşça yoğurur gibi hareket ettir.', 'Cildi çekme.']);
f('kulak-onu', 'Kulak önü masajı', 'Pre-auricular massage', 'face-yanak', 'ms', time(40), ['Parmakları kulağın hemen önüne koy.', 'Hafifçe daireler çiz.', 'Çene eklemi ağrılıysa uygulama.'], JAW);
f('agiz-kosesi', 'Ağız köşesi yukarı sıvazlama', 'Mouth corner lift strokes', 'face-yanak', 'ms', time(30), ['Parmak uçlarını ağız köşelerine koy.', 'Hafifçe yukarı ve dışa kaydır.', 'Yavaş tekrarla.']);
f('yanak-isit', 'Avuçla yanak ısıtma', 'Palm cheek warm', 'face-yanak', 'ms', time(30), ['Avuçlarını birbirine sürterek ısıt.', 'Yanaklarının üzerine koy.', 'Hafif ısıyı hisset, nefes al.']);

// ───────── Çene hattı ─────────
f('cene-yukari', 'Çeneyi havaya kaldırma', 'Chin lift (kiss the ceiling)', 'face-cene', 'ex', reps(2, 10, 10), ['Dik otur, başını hafifçe geriye al.', 'Tavana öpücük gönderir gibi dudaklarını büz.', '5 saniye tut, bırak.'], NECK);
f('cene-ileri', 'Çeneyi ileri çıkarma', 'Jaw forward', 'face-cene', 'ex', reps(2, 10, 10), ['Alt çeneni yavaşça öne çıkar.', '3 saniye tut.', 'Yavaşça geri getir.'], JAW);
f('cene-yana', 'Çeneyi sağa sola kaydırma', 'Jaw side shift', 'face-cene', 'ex', reps(2, 8, 10), ['Çeneni hafifçe sağa kaydır.', 'Sonra sola.', 'Ağrısız aralıkta kal.'], JAW);
f('dil-damak', 'Dili damağa bastırma', 'Tongue press', 'face-cene', 'ex', time(15, 10, 3), ['Dilinin tamamını damağına bastır.', 'Çene altındaki kasları hisset.', '15 saniye tut.']);
f('alt-dudak', 'Alt dudağı üste çekme', 'Lower lip lift', 'face-cene', 'ex', reps(2, 10, 10), ['Alt dudağını üst dudağının üstüne çek.', 'Çene kasının gerildiğini hisset.', '3 saniye tut.']);
f('cene-sik', 'Çene kası sıkma', 'Jaw clench hold', 'face-cene', 'ex', time(10, 10, 3), ['Dişlerini hafifçe kapat.', 'Çene kasını sıkıp gevşet.', 'Aşırı güç kullanma.'], JAW);
f('cene-hatti-siva', 'Çene hattı sıvazlama', 'Jawline strokes', 'face-cene', 'ms', time(45), ['Başparmak ile işaret parmağı arasına çene ucunu al.', 'Hafifçe kulağa doğru kaydır.', 'İki tarafı da yap.']);
f('cene-alti-siva', 'Çene altı sıvazlama', 'Under-chin strokes', 'face-cene', 'ms', time(40), ['Elinin ön yüzünü çene altına koy.', 'Hafifçe boyundan çeneye doğru kaydır.', 'Sırayla iki elle.']);
f('masseter', 'Çene kası (masseter) masajı', 'Masseter massage', 'face-cene', 'ms', time(40), ['Parmak uçlarını çene köşesine koy.', 'Hafifçe daireler çiz.', 'Çene ağrıyorsa uygulama.'], JAW);
f('cene-ucu-daire', 'Çene ucu daire masajı', 'Chin circles', 'face-cene', 'ms', time(30), ['Parmak ucunu çene ucuna koy.', 'Küçük daireler çiz.', 'Çok hafif bastır.']);
f('kulak-alti', 'Kulak altı masajı', 'Behind-ear massage', 'face-cene', 'ms', time(30), ['Parmakları kulak arkasına koy.', 'Hafifçe daireler çiz.', 'Aşağı boyuna doğru ilerle.'], NECK);
f('cene-eklem', 'Çene eklemi çevresi hafif masaj', 'TMJ area massage', 'face-cene', 'ms', time(30), ['Parmak uçlarını kulak önündeki çene eklemine koy.', 'Çok hafif daireler çiz.', 'Ağrı varsa hemen bırak.'], JAW);

// ───────── Gıdı ve boyun ─────────
f('gidi-oper', 'Öpücük göndererek gıdı kaldırma', 'Kiss the ceiling', 'face-gidi', 'ex', reps(2, 12, 10), ['Dik otur, başını geriye eğ.', 'Tavana öpücük gönderir gibi dudaklarını uzat.', 'Gıdı altında gerilmeyi hisset, bırak.'], NECK);
f('dil-uzat', 'Başı geride dil uzatma', 'Head back tongue stretch', 'face-gidi', 'ex', reps(2, 8, 10), ['Başını hafifçe geriye al.', 'Dilini çenene doğru uzat.', '5 saniye tut.'], NECK);
f('yuzu-saga-sola', 'Yüzünü sağa sola çevirme', 'Neck rotation', 'face-gidi', 'ex', reps(2, 10, 10), ['Dik dur.', 'Yüzünü yavaşça sağa, sonra sola çevir.', 'Çenen omuzla aynı hizada kalsın, zorlama.'], NECK);
f('boyun-yan', 'Boyun yan esnetme', 'Side neck stretch', 'face-gidi', 'ex', time(20, 10, 2), ['Kulağını omzuna doğru yavaşça indir.', '20 saniye tut.', 'Diğer tarafa geç.'], NECK);
f('esneme-agiz', 'Esner gibi ağzı açma', 'Yawn stretch', 'face-gidi', 'ex', reps(2, 8, 10), ['Ağzını yavaşça geniş aç.', 'Boynun önünde gerilmeyi hisset.', 'Yavaşça kapat.'], JAW);
f('cene-alti-direnc', 'Çene altı dirençli bastırma', 'Chin push resistance', 'face-gidi', 'ex', time(10, 10, 3), ['Yumruğunu çene altına koy.', 'Çeneni yumruğa karşı hafifçe bastır.', '10 saniye tut.']);
f('boyun-uzat', 'Boynu uzatma', 'Neck lengthening', 'face-gidi', 'ex', time(15, 10, 2), ['Omuzlarını aşağı çek.', 'Başının tepesi tavana uzansın.', '15 saniye tut.']);
f('gidi-asagidan-yukari', 'Gıdı altı aşağıdan yukarı sıvazlama', 'Under-chin upward strokes', 'face-gidi', 'ms', time(45), ['Elinin ön yüzünü boyun altına koy.', 'Hafifçe çeneye doğru kaydır.', 'Sırayla iki elle.'], NECK);
f('boyun-on-asagi', 'Boyun önü aşağı sıvazlama', 'Front neck downward strokes', 'face-gidi', 'ms', time(40), ['Parmakları çene altından başlat.', 'Çok hafifçe köprücük kemiğine doğru kaydır.', 'Yan taraftaki damarlara basma.'], NECK);
f('ense-masaji', 'Ense masajı', 'Nape massage', 'face-gidi', 'ms', time(45), ['Elini ensene koy.', 'Parmak uçlarıyla yavaş daireler çiz.', 'Omuzlarını gevşet.']);
f('kopru-kemigi', 'Köprücük kemiği sıvazlama', 'Collarbone strokes', 'face-gidi', 'ms', time(30), ['Parmakları köprücük kemiğinin altına koy.', 'Hafifçe omuza doğru kaydır.', 'Yavaş ve hafif ol.']);
f('omuz-boyun-gevset', 'Omuz ve boyun gevşetme', 'Shoulder and neck release', 'face-gidi', 'ms', time(45), ['Karşı elinle omuz üstünü hafifçe sık.', 'Boyna doğru yavaşça yoğur.', 'Nefes al, gevşe.'], NECK);

// ───────── Dudak ve ağız çevresi ─────────
f('dudak-buz', 'Dudak büzme', 'Lip pucker', 'face-dudak', 'ex', reps(2, 10, 10), ['Dudaklarını öne doğru büz.', '3 saniye tut.', 'Gevşet.']);
f('o-e-sesli', '“O” ve “E” sesli harf egzersizi', 'O–E vowel exercise', 'face-dudak', 'ex', reps(2, 10, 10), ['Ağzını abartıyla “O” yap.', 'Sonra geniş “E” yap.', 'Aralıksız geçiş yap.']);
f('gulumse-buz', 'Gülümseme ve büzme geçişi', 'Smile–pucker switch', 'face-dudak', 'ex', reps(2, 12, 10), ['Geniş gülümse.', 'Sonra dudaklarını öne büz.', 'Yavaş değiştir.']);
f('dudak-sik', 'Dudakları sıkıp tutma', 'Lip press hold', 'face-dudak', 'ex', time(10, 10, 3), ['Dudaklarını birbirine sıkıca bastır.', '10 saniye tut.', 'Gevşet.']);
f('hava-tut-dudak', 'Havayı dudaklar arasından bırakma', 'Controlled air release', 'face-dudak', 'ex', reps(2, 8, 10), ['Yanaklarına hava doldur.', 'Dudaklarının arasından yavaşça bırak.', 'Hızını kontrol et.']);
f('dudak-titret', 'Dudak titretme', 'Lip trill', 'face-dudak', 'ex', time(20, 10, 2), ['Dudaklarını gevşet.', 'Nefes vererek titret.', 'Rahat ve kontrollü ol.']);
f('dudak-cevresi-daire', 'Dudak çevresi daire masajı', 'Lip contour circles', 'face-dudak', 'ms', time(30), ['Parmak uçlarını dudak çevresine koy.', 'Çok hafif daireler çiz.', 'Köşelere doğru ilerle.']);
f('dudak-kosesi-yukari', 'Dudak köşesi yukarı masajı', 'Lip corner lift massage', 'face-dudak', 'ms', time(30), ['Parmak uçlarını dudak köşelerine koy.', 'Hafifçe yukarı kaydır.', 'Yavaş tekrarla.']);
f('ust-dudak', 'Üst dudak üstü sıvazlama', 'Upper lip strokes', 'face-dudak', 'ms', time(30), ['İşaret parmağını burun altına koy.', 'Hafifçe yanlara kaydır.', 'Sert bastırma.']);

// ───────── Tüm yüz ─────────
f('aslan-yuzu', 'Aslan yüzü', 'Lion face', 'face-tum', 'ex', reps(2, 8, 10), ['Derin nefes al.', 'Nefes verirken yüzünü ve dilini geniş aç.', 'Sonra gevşet.']);
f('yuz-sik-gevset', 'Tüm yüzü sıkıp gevşetme', 'Whole face squeeze and release', 'face-tum', 'ex', reps(2, 8, 10), ['Yüzünün tüm kaslarını merkeze doğru sık.', '3 saniye tut.', 'Hepsini bırak.']);
f('yuz-isinma', 'Yüz ısınma serisi', 'Face warm-up', 'face-tum', 'ex', time(45), ['Kaşlarını kaldır ve indir.', 'Yanak ve çeneni yavaşça hareket ettir.', 'Yüzünü sağa sola çevir.']);
f('alin-yanak-cene', 'Alın, yanak, çene sıralı seri', 'Forehead–cheek–jaw sequence', 'face-tum', 'ex', time(60), ['Kaş kaldırma yap.', 'Yanak şişirip bırak.', 'Çene kaldırma ile bitir.'], JAW);
f('yuz-gevsetme', 'Yüz gevşetme nefesi', 'Face relax breathing', 'face-tum', 'ex', time(60), ['Gözlerini kapat.', 'Nefes alırken yüzü gerdir, verirken bırak.', 'Gerginliği hisset ve bırak.']);
f('yuz-genel-siva', 'Alından çeneye genel sıvazlama', 'Full face strokes', 'face-tum', 'ms', time(60), ['Temiz yüze nemlendirici sür.', 'Alından başlayıp yanaklardan çeneye kaydır.', 'Hafif ve yavaş ol.']);
f('lenf-hafif', 'Hafif lenf drenajı hareketi', 'Light lymph drainage strokes', 'face-tum', 'ms', time(60), ['Parmak uçlarını yüzün ortasına koy.', 'Çok hafifçe dışa, kulaklara doğru kaydır.', 'Bastırma, yalnızca cildi okşar gibi.'], NECK);
f('avuc-isit', 'Avuç ısıtma ve yüze koyma', 'Palm warm press', 'face-tum', 'ms', time(30), ['Avuçlarını sürterek ısıt.', 'Yüzüne nazikçe koy.', 'Nefes al, gevşe.']);
f('kafa-derisi', 'Kafa derisi masajı', 'Scalp massage', 'face-tum', 'ms', time(60), ['Parmak uçlarını saç diplerine koy.', 'Küçük, yavaş daireler çiz.', 'Alından ensene ilerle.']);
f('kulak-masaji', 'Kulak masajı', 'Ear massage', 'face-tum', 'ms', time(40), ['Kulak memelerini hafifçe tut.', 'Yukarı doğru nazikçe yoğur.', 'İki taraf da.']);
f('nemlendirici-masaj', 'Nemlendiricili yüz masajı', 'Moisturizer massage', 'face-tum', 'ms', time(60), ['Yüzüne nemlendirici sür.', 'Parmak uçlarıyla içten dışa hafifçe kaydır.', 'Cildi çekme.']);

export const FACE_ITEMS: LibraryItem[] = ROWS.map((r) => r.item);
export const FACE_EN: Record<string, string> = Object.fromEntries(ROWS.map((r) => [r.item.id, r.en]));
// Mevcut yüz masajı hareketlerinin bölgesi (katalogdaki ilk üç kayıt)
export const FACE_META: Record<string, { region: FaceRegion; type: FaceType }> = {
  ...Object.fromEntries(ROWS.map((r) => [r.item.id, { region: r.region, type: r.type }])),
  'face-temple': { region: 'face-alin', type: 'ms' },
  'face-brow': { region: 'face-goz', type: 'ms' },
  'face-cheek': { region: 'face-yanak', type: 'ms' },
};
