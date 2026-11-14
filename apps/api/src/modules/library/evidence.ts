// Hareket kanıt katmanı: her hareketin kaynakları, doğrulama durumu, varyasyon ilişkisi ve kaynaklı içeriği.
// Araştırma kaydı: docs/research/exercise-pilot.json. Kaynakta olmayan bilgi buraya YAZILMAZ.
// Doğrulama: 'ok' = en az 2 kaynak, 'partial' = tek kaynak ya da ikinci kaynak zayıf, 'held' = kaynak yetersiz (etiketle gösterilir).
// Kimliği burada olmayan hareket henüz taranmamıştır ("none").
import type { Work } from './catalog.js';

export type Verification = 'ok' | 'partial' | 'held';
export type AltType = 'EASIER' | 'HARDER' | 'EQUIVALENT' | 'NO_EQUIPMENT';

export interface Source {
  publisher: string;
  url: string;
  // Kaynağın tamamı okundu mu (false = erişilemedi, arama özetinden)
  read: boolean;
}

export const SOURCES: Record<string, Source> = {
  'nhs-strength': { publisher: 'NHS (UK) — Strength exercises', url: 'https://www.nhs.uk/live-well/exercise/strength-exercises/', read: true },
  'ace-goblet': { publisher: 'ACE Fitness — Goblet squat', url: 'https://www.acefitness.org/resources/everyone/exercise-library/362/goblet-squat/', read: true },
  'ace-squatjump': { publisher: 'ACE Fitness — Squat jump', url: 'https://www.acefitness.org/resources/everyone/exercise-library/222/squat-jump/', read: true },
  'ace-bridge': { publisher: 'ACE Fitness — Glute bridge', url: 'https://www.acefitness.org/resources/everyone/exercise-library/49/glute-bridge/', read: true },
  'ace-bridge-sl': { publisher: 'ACE Fitness — Single-leg glute bridge', url: 'https://www.acefitness.org/resources/everyone/exercise-library/145/glute-bridge-single-leg-progression/', read: true },
  'ace-shuffle': { publisher: 'ACE Fitness — Lateral shuffles', url: 'https://www.acefitness.org/resources/everyone/exercise-library/181/lateral-shuffles/', read: true },
  'cc-dog': { publisher: 'Cleveland Clinic — Downward dog', url: 'https://health.clevelandclinic.org/downward-dog-adho-mukha-svanasana', read: true },
  'cc-posture': { publisher: 'Cleveland Clinic — Posture exercises', url: 'https://health.clevelandclinic.org/posture-exercises', read: true },
  'cc-breathing': { publisher: 'Cleveland Clinic — Diaphragmatic breathing', url: 'https://my.clevelandclinic.org/health/articles/9445-diaphragmatic-breathing', read: true },
  'harvard-bird-dog': { publisher: 'Harvard Health — Bird dog', url: 'https://www.harvardhealth.org/exercise-and-fitness/bird-dog-exercise-for-your-core-how-to-do-it-safely', read: true },
  'harvard-pushup': { publisher: 'Harvard Health — Modify your push-ups', url: 'https://www.harvardhealth.org/exercise-and-fitness/modify-your-push-ups-to-meet-your-fitness-level', read: true },
  'nia-wall-pushup': { publisher: 'NIH / National Institute on Aging — Wall push-up', url: 'https://go4life.nia.nih.gov/exercise/wall-push-up/', read: false },
  'mayo-squat': { publisher: 'Mayo Clinic — Squat', url: 'https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/squat/vid-20084663', read: false },
  'mayo-calf': { publisher: 'Mayo Clinic — Calf raise', url: 'https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/calf-raise/vid-20084681', read: false },
  'nasm-goblet': { publisher: 'NASM — Goblet squat', url: 'https://www.nasm.org/resource-center/blog/training/how-to-perform-goblet-squats', read: false },
  'hopkins-breath': { publisher: 'Johns Hopkins Medicine — Breathing techniques', url: 'https://www.hopkinsmedicine.org/breathlessness-clinic/breathing-techniques', read: false },
  'jama-face': { publisher: 'JAMA Dermatology 2018 — Facial exercise pilot (PMC5885810)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5885810/', read: true },
  'harvard-face': { publisher: 'Harvard Health — Can facial exercises reverse the signs of aging?', url: 'https://www.harvardhealth.org/blog/can-facial-exercises-reverse-the-signs-of-aging-2019022016042', read: true },
};

export interface Evidence {
  nameEn: string;
  // Aynı hareket ailesi (yalnızca gerçek varyasyonlar) ve hangi harekete göre varyasyon
  family?: string;
  variationOf?: string;
  verification: Verification;
  sources: string[];
  alternatives: { id: string; type: AltType; note?: string }[];
  // Yalnızca kaynağa dayanan ek bilgi
  note?: string;
}

export const EVIDENCE: Record<string, Evidence> = {
  'sit-to-stand': { nameEn: 'Sit-to-stand', family: 'squat', verification: 'partial', sources: ['nhs-strength'], alternatives: [{ id: 'mini-squat', type: 'HARDER' }], note: 'NHS: 5 tekrar, yavaş yapmak daha iyi; elleri sadece yönlendirmek için kullan.' },
  'mini-squat': { nameEn: 'Mini-squat', family: 'squat', variationOf: 'sit-to-stand', verification: 'ok', sources: ['nhs-strength', 'mayo-squat'], alternatives: [{ id: 'sit-to-stand', type: 'EASIER' }, { id: 'squat', type: 'HARDER' }], note: 'NHS: 5 tekrar. Mayo (özetten): sırt nötr, karın sıkı, dizler ayakların üzerinde.' },
  squat: { nameEn: 'Bodyweight squat', family: 'squat', variationOf: 'mini-squat', verification: 'partial', sources: ['mayo-squat'], alternatives: [{ id: 'mini-squat', type: 'EASIER' }, { id: 'goblet-squat', type: 'HARDER' }, { id: 'step-up', type: 'EQUIVALENT' }] },
  'goblet-squat': { nameEn: 'Goblet squat', family: 'squat', variationOf: 'squat', verification: 'partial', sources: ['ace-goblet', 'nasm-goblet'], alternatives: [{ id: 'squat', type: 'EASIER' }], note: 'ACE sayfasında hata, güvenlik ve set/tekrar bilgisi yok; hatalar NASM özetinden.' },
  'squat-jump': { nameEn: 'Squat jump', family: 'squat', variationOf: 'squat', verification: 'partial', sources: ['ace-squatjump'], alternatives: [{ id: 'squat', type: 'EASIER' }, { id: 'step-jacks', type: 'EASIER' }], note: 'ACE: önce squat ve iniş mekaniği öğrenilmeli; küçük zıplamalarla başla.' },
  'glute-bridge': { nameEn: 'Glute bridge', family: 'bridge', verification: 'partial', sources: ['ace-bridge'], alternatives: [{ id: 'single-leg-glute-bridge', type: 'HARDER' }, { id: 'bird-dog', type: 'EQUIVALENT' }] },
  'single-leg-glute-bridge': { nameEn: 'Single-leg glute bridge', family: 'bridge', variationOf: 'glute-bridge', verification: 'partial', sources: ['ace-bridge-sl'], alternatives: [{ id: 'glute-bridge', type: 'EASIER' }] },
  'wall-push-up': { nameEn: 'Wall push-up', family: 'push-up', verification: 'ok', sources: ['nhs-strength', 'harvard-pushup', 'nia-wall-pushup'], alternatives: [{ id: 'knee-push-up', type: 'HARDER' }, { id: 'db-floor-press', type: 'EQUIVALENT' }], note: 'Kaynaklar tekrarda ayrışıyor: NHS 5-10, NIA 10-15. Harvard: ayaklar duvardan uzaklaştıkça zorlaşır.' },
  'knee-push-up': { nameEn: 'Knee push-up', family: 'push-up', variationOf: 'wall-push-up', verification: 'partial', sources: ['harvard-pushup'], alternatives: [{ id: 'wall-push-up', type: 'EASIER' }, { id: 'push-up', type: 'HARDER' }] },
  'bird-dog': { nameEn: 'Bird dog', family: 'quadruped-core', verification: 'partial', sources: ['harvard-bird-dog'], alternatives: [{ id: 'dead-bug', type: 'EASIER' }], note: 'Harvard: bir kol-bacak çiftiyle 10 tekrar, sonra diğer çift. Tutuş süresi kaynaklarda 2-5 ve 5-10 sn arasında ayrışıyor.' },
  'calf-raise': { nameEn: 'Calf raise', verification: 'ok', sources: ['nhs-strength', 'mayo-calf'], alternatives: [], note: 'NHS: 5 tekrar, destekle; Mayo (özetten): 12-15 tekrar. Desteksiz yapmak daha zordur.' },
  'downward-dog': { nameEn: 'Downward-facing dog', family: 'yoga-flow', verification: 'partial', sources: ['cc-dog'], alternatives: [{ id: 'child-pose', type: 'EASIER' }, { id: 'cat-cow', type: 'EASIER' }], note: 'Cleveland Clinic: genelde 10-15 sn tut; uzun tutmaktan kaçın.' },
  'chin-tuck': { nameEn: 'Chin tuck', family: 'posture-neck', verification: 'partial', sources: ['cc-posture'], alternatives: [{ id: 'doorway-stretch', type: 'EQUIVALENT' }], note: 'Cleveland Clinic bir klinisyen görüşüdür; çalışma atfı yoktur.' },
  'wall-angel': { nameEn: 'Wall angel', family: 'posture-neck', verification: 'held', sources: ['cc-posture'], alternatives: [{ id: 'scapular-squeeze', type: 'EQUIVALENT' }], note: 'Tek kaynak, tekrar/set bilgisi yok; doğrulama sürüyor.' },
  'deep-breathing': { nameEn: 'Diaphragmatic breathing', verification: 'ok', sources: ['cc-breathing', 'hopkins-breath'], alternatives: [{ id: 'child-pose', type: 'EQUIVALENT' }], note: 'Fayda iddiaları gösterilmez: kaynaklarda çalışma özeti yok.' },
  'lateral-shuffle': { nameEn: 'Lateral shuffles', family: 'agility', verification: 'partial', sources: ['ace-shuffle'], alternatives: [{ id: 'step-jacks', type: 'EASIER' }] },
  'mountain-climber': { nameEn: 'Mountain climber', family: 'plank-based', verification: 'held', sources: [], alternatives: [{ id: 'dead-bug', type: 'EASIER' }, { id: 'step-jacks', type: 'EASIER' }], note: 'Resmî kaynak bulunamadı; yalnızca blog özetleri var. Doğrulama sürüyor.' },
  'face-temple': { nameEn: 'Facial exercise (temple)', verification: 'held', sources: ['jama-face', 'harvard-face'], alternatives: [], note: 'Yüz egzersizleri ve masajı için kanıt sınırlıdır; sonuç garanti edilmez.' },
  'face-brow': { nameEn: 'Facial exercise (brow)', verification: 'held', sources: ['jama-face', 'harvard-face'], alternatives: [], note: 'Yüz egzersizleri ve masajı için kanıt sınırlıdır; sonuç garanti edilmez.' },
  'face-cheek': { nameEn: 'Facial exercise (cheek)', verification: 'held', sources: ['jama-face', 'harvard-face'], alternatives: [], note: 'Yüz egzersizleri ve masajı için kanıt sınırlıdır; sonuç garanti edilmez.' },
};

// Kaynakta yazan içerik: katalogdaki taslak metinlerin ve değerlerin üzerine yazılır.
// 'basis': SOURCE = değer doğrudan kaynaktan; RULE = uygulamanın açık varsayılan kuralı (kaynakta yok)
export interface ContentOverride {
  steps?: string[];
  mistakes?: string[];
  warnings?: string[];
  work?: Work;
  workBasis?: 'SOURCE' | 'RULE';
}

const W = (sets: number, restSec: number, extra: Partial<Work>): Work => ({ sets, restSec, ...extra });

export const CONTENT: Record<string, ContentOverride> = {
  'wall-push-up': {
    steps: ['Duvara bir kol boyu uzaklıkta dur; elleri göğüs hizasında duvara yasla, parmaklar yukarı.', 'Baştan topuğa düz çizgiyi koru; dirsekleri vücuda yakın bükerek duvara yaklaş.', 'Kısaca dur, başlangıca geri it.', 'Nefes alarak in, vererek it; nefesi tutma.'],
    mistakes: ['Sırtın çökmesi ya da bel çukurlaşması', 'Duvara kontrolsüz düşmek'],
    warnings: ['Bilek ya da omuzda ağrı olursa dur.', 'Eklem sorunun varsa başlamadan önce bir sağlık uzmanına danış.'],
    work: W(3, 45, { reps: 8 }),
    workBasis: 'RULE',
  },
  'calf-raise': {
    steps: ['Sandalyenin arkasında dur, elleri sırtlığa koy; ayaklar yerde.', 'İki topuğu rahat olduğun kadar yavaş ve kontrollü kaldır.', 'Yavaşça in.'],
    mistakes: [],
    warnings: ['Denge için sandalye ya da duvar kullan.', 'Ayak bileğinde ağrı hissedersen dur.'],
    work: W(2, 30, { reps: 12 }),
    workBasis: 'RULE',
  },
  'bird-dog': {
    steps: ['Eller omuz altında, dizler kalça altında dört ayak pozisyonu al; baş ve omurga nötr.', 'Bir bacağı geriye uzat, karşı kolu öne uzat; kalça ve omuzlar yere paralel kalsın.', 'Kol ve bacak yaklaşık yere paralel olunca kısaca tut.', 'Başlangıca dön, diğer çifte geç.'],
    mistakes: ['Sırtı çukurlaştırmak', 'Yukarı bakmak', 'Kalçayı çevirmek', 'Kol ya da bacağı gövdeden yukarı kaldırmak', 'Kontrol yerine hıza odaklanmak'],
    warnings: ['Kötü form bel ve boyun yaralanma riskini artırır; kontrollü yap.', 'Yer rahatsız ediyorsa yatak üzerinde diz çökerek yap.', 'Yeni bir bel sakatlığın ya da akut ağrın varsa önce bir sağlık uzmanına danış.'],
    work: W(2, 30, { reps: 10, perSide: true }),
    workBasis: 'SOURCE',
  },
  'glute-bridge': {
    steps: ['Sırtüstü yat; dizler bükük, ayaklar kalça genişliğinde ve düz.', 'Karnı hafifçe sıkarak belini yere yaklaştır; bu sıkılığı koru.', 'Nefes ver, kalçayı sıkarak kaldır; topuklarla it.', 'Nefes alarak yavaşça in.'],
    mistakes: ['Kalçayı çok yukarı kaldırıp bel çukurlaştırmak', 'Karın sıkılığını kaybetmek', 'Dizlerin içe kapanması'],
    warnings: ['Aşırı bel çukurlaşmasından kaçın; belde ağrı hissedersen dur.'],
  },
  'single-leg-glute-bridge': {
    steps: ['Sırtüstü yat, dizler bükük; bir bacağı göğse çek, diğer ayağı merkeze kaydır, karnı sık.', 'Nefes ver, yerdeki ayakla it ve aynı taraf kalçayı sıkarak kaldır.', 'Nefes alarak kontrollü in; sonra taraf değiştir.'],
    mistakes: ['Kalçayı çok yukarı itmek', 'Karın sıkılığını kaybetmek'],
    warnings: ['Karın kasların boyunca aktif kalsın (bel koruması); kalçayı kasınla kontrol edebildiğin kadar kaldır.'],
  },
  'goblet-squat': {
    steps: ['Ayaklar omuz genişliğinde; dambılı göğüs önünde dik tut, dirsekler kaburgaya yakın, sırt dik.', 'Kalçan dizlerinin altına inene ya da belin yuvarlanmadan inebildiğin yere kadar çömel.', 'Ayaklarınla zemini iterek ayağa kalk.'],
    mistakes: ['Ağırlığın göğüsten uzaklaşması', 'Dizlerin içe çökmesi', 'Belin yuvarlanması', 'Hızlı düşüp sekmek', 'Topukların kalkması'],
    warnings: ['Diz ya da belde ağrı olursa derinliği azalt veya mini squat\'a dön.'],
  },
  'downward-dog': {
    steps: ['Dört ayak: eller omuz genişliğinde, dizler kalça altında.', 'Parmakları aç, ellerle it, ayak parmaklarını altına kıvır.', 'Nefes ver, kalçayı yukarı-geri kaldırıp ters V yap.', 'Sırt uzun; baş ve boyun kollar arasında gevşek; bacaklar dik, topuklar rahat olduğu kadar yere.', 'Sabit nefes al; çıkarken dört ayak ya da çocuk duruşuna in.'],
    mistakes: ['Sırtı yuvarlamak', 'Ayakları çok açık koymak', 'Bileğe fazla yüklenmek'],
    warnings: ['Yüksek tansiyon, glokom, kalp sorunu, baş dönmesi ya da bayılma öykün varsa önce bir uzmana danış.', 'Bilek rahatsızlığında ellerin topuğuna kıvrılmış havlu koy.', 'Aşırı gerginlik hissedersen çık.'],
    work: W(3, 15, { seconds: 15 }),
    workBasis: 'SOURCE',
  },
  'deep-breathing': {
    steps: ['Sırtüstü yat, dizler bükük, baş desteklenmiş; bir el üst göğüste, biri kaburga altında.', 'Burundan yavaşça nefes al; karın kalksın, üst göğüs mümkün olduğunca sabit kalsın.', 'Karın kaslarını sıkarak büzülmüş dudaklarla ver.', 'Alışınca sandalyede otururak yap.'],
    mistakes: ['Üst göğsün kalkması (hedef: karın hareket etsin)'],
    warnings: ['KOAH, astım ya da anksiyete varsa önce bir sağlık uzmanına danış; tek başına tedavi değildir.', 'İlk denemelerde baş dönmesi olabilir; olursa normal nefese dön.'],
    work: W(1, 0, { seconds: 300 }),
    workBasis: 'SOURCE',
  },
  'chin-tuck': {
    steps: ['Omuzlar geride, ayaklar yerde otur.', 'Çeneni yukarı ya da aşağı eğmeden düz geri çek; parmak uçlarınla yönlendirebilirsin.', 'Birkaç saniye tut.'],
    mistakes: ['Çeneyi aşağı ya da yukarı eğmek (baş düz geri kaymalı)'],
    warnings: ['Ağrı sürerse ya da egzersizler yardım etmezse doktor veya fizyoterapiste başvur.', 'Kola yayılan ağrı ya da baş ağrısı artarsa dur.'],
  },
  'lateral-shuffle': {
    steps: ['Sporcu duruşu: ayaklar kalça genişliğinde, dizler bükük, ağırlık kalçada; karın sıkı.', 'Ağırlığı yana kaydır, ilerlediğin yönün ayağını kaldır, arkadaki ayakla it.', 'Ayaklar paralel, parmaklar önde; hızlı ve kısa adımlar.', 'Sonda yön değiştirip aynı formla geri dön.'],
    mistakes: [],
    warnings: ['Kaygan zeminde yapma.', 'Diz ya da ayak bileği sorunun varsa adım açmayı seç.'],
  },
};

// Yüz egzersizi/masajı için sabit uyarı (kanıt sınırlı)
export const FACE_EVIDENCE_WARNING = 'Yüz egzersizleri ve masajı için bilimsel kanıt sınırlıdır; sonuç garanti edilmez. Cilt yaşlanmasına karşı günlük SPF 30+ güneş koruyucunun kanıtı çok daha güçlüdür.';
