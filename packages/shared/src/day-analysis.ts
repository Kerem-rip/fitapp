// Gün sonu analizi (herkese açık): yenen, içilen ve yapılan hareketler hedefle karşılaştırılır. SAF kurallar; tanı koymaz.
// Kullanıcı kendi isteğiyle az yediyse bu onun tercihidir: engellenmez, yalnızca sakin bir dille bilgi verilir.
import type { ToolGoal } from './calorie-tool';

export interface DayAnalysisInput {
  goal?: ToolGoal | null;
  targetKcal: number | null;
  targetProteinG: number | null;
  waterGoalMl: number;
  // Güvenli alt kalori sınırı (altı "çok düşük" sayılır)
  floorKcal: number;
  eaten: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  mealCount: number;
  waterMl: number;
  workoutsDone: number;
  workoutMinutes: number;
  // Antrenmanların tahmini enerji harcaması (MET ile; tahmin)
  burnedKcal: number;
  tasksDone: number;
  tasksTotal: number;
}

export type InsightLevel = 'good' | 'info' | 'warn';
export type InsightTopic = 'kcal' | 'protein' | 'water' | 'activity' | 'tasks' | 'general';
export interface Insight {
  level: InsightLevel;
  topic: InsightTopic;
  text: string;
}

export interface DayAnalysis {
  insights: Insight[];
  // Yenen − hedef (negatif = hedefin altında); hedef yoksa null
  balanceKcal: number | null;
  empty: boolean;
}

const KCAL_PER_KG = 7700;

export function analyzeDay(d: DayAnalysisInput): DayAnalysis {
  const insights: Insight[] = [];
  const empty = d.mealCount === 0 && d.waterMl === 0 && d.workoutsDone === 0 && d.tasksDone === 0;
  if (empty) {
    return { insights: [{ level: 'info', topic: 'general', text: 'Bugün için henüz kayıt yok. Yediklerini, içtiklerini ve yaptığın hareketleri eklersen günün analizini burada görürsün.' }], balanceKcal: null, empty: true };
  }

  // Kalori
  let balance: number | null = null;
  if (d.mealCount > 0) {
    if (d.eaten.kcal < d.floorKcal) {
      insights.push({
        level: 'warn',
        topic: 'kcal',
        text: `Bugün yaklaşık ${d.eaten.kcal} kcal yedin; bu, günlük önerilen alt sınırın (${d.floorKcal} kcal) altında. Bu senin tercihin; yine de uzun süre çok az yemek yorgunluğa ve besin eksikliğine yol açabilir. Endişen varsa bir diyetisyene danışabilirsin.`,
      });
    }
    if (d.targetKcal) {
      balance = d.eaten.kcal - d.targetKcal;
      const ratio = d.eaten.kcal / d.targetKcal;
      if (d.eaten.kcal >= d.floorKcal) {
        if (ratio >= 0.9 && ratio <= 1.1) insights.push({ level: 'good', topic: 'kcal', text: `Kalorin hedefine çok yakın (${d.eaten.kcal} / ${d.targetKcal} kcal).` });
        else if (ratio < 0.9) {
          const weekly = Math.round(((-balance * 7) / KCAL_PER_KG) * 100) / 100;
          insights.push({
            level: d.goal === 'gain' || d.goal === 'muscle' ? 'warn' : 'info',
            topic: 'kcal',
            text:
              d.goal === 'gain' || d.goal === 'muscle'
                ? `Hedefinin yaklaşık ${Math.abs(balance)} kcal altındasın; kilo almak/kas yapmak istiyorsan biraz daha yemek gerekebilir.`
                : `Hedefinin yaklaşık ${Math.abs(balance)} kcal altındasın. Bu tempo her gün sürerse tahmini olarak haftada ~${weekly} kg fark yaratır (tahmindir).`,
          });
        } else {
          insights.push({
            level: d.goal === 'lose' ? 'warn' : 'info',
            topic: 'kcal',
            text: `Hedefinin yaklaşık ${balance} kcal üzerindesin${d.goal === 'lose' ? '; kilo vermek istiyorsan yarın biraz hafifletebilirsin' : ''}.`,
          });
        }
      }
    }
    // Protein
    if (d.targetProteinG && d.targetProteinG > 0) {
      const p = d.eaten.proteinG / d.targetProteinG;
      if (p >= 0.9) insights.push({ level: 'good', topic: 'protein', text: `Protein hedefine ulaştın (${Math.round(d.eaten.proteinG)} / ${d.targetProteinG} g).` });
      else if (p < 0.7) insights.push({ level: 'info', topic: 'protein', text: `Protein hedefinin altında (${Math.round(d.eaten.proteinG)} / ${d.targetProteinG} g). Yumurta, yoğurt, baklagil, balık ve tavuk gibi kaynaklar eklenebilir.` });
    }
  }

  // Su
  if (d.waterGoalMl > 0) {
    const w = d.waterMl / d.waterGoalMl;
    insights.push(
      w >= 1
        ? { level: 'good', topic: 'water', text: `Su hedefini tamamladın (${(d.waterMl / 1000).toLocaleString('tr-TR')} L).` }
        : { level: 'info', topic: 'water', text: `Su: ${(d.waterMl / 1000).toLocaleString('tr-TR')} / ${(d.waterGoalMl / 1000).toLocaleString('tr-TR')} L. ${w < 0.6 ? 'Gün içinde biraz daha su içmeyi dene.' : 'Hedefe yakınsın.'}` },
    );
  }

  // Hareket
  insights.push(
    d.workoutsDone > 0
      ? { level: 'good', topic: 'activity', text: `Bugün ${d.workoutsDone} antrenman tamamladın (~${d.workoutMinutes} dk, tahmini ~${d.burnedKcal} kcal harcama).` }
      : { level: 'info', topic: 'activity', text: 'Bugün tamamlanmış antrenman kaydı yok. Kısa bir yürüyüş ya da hafif bir kart bile iyi gelir.' },
  );

  // Görevler
  if (d.tasksTotal > 0) {
    insights.push(
      d.tasksDone >= d.tasksTotal
        ? { level: 'good', topic: 'tasks', text: 'Tüm görevlerini tamamladın.' }
        : { level: 'info', topic: 'tasks', text: `Görevlerin: ${d.tasksDone} / ${d.tasksTotal} tamam.` },
    );
  }

  insights.push({ level: 'info', topic: 'general', text: 'Bu analiz tahminlere dayanır ve tıbbi tavsiye değildir.' });
  return { insights, balanceKcal: balance, empty: false };
}
