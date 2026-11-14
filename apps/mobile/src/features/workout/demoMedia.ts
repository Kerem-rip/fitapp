// GEÇİCİ DEMO GÖRSELLERİ: Wikimedia Commons'tan serbest lisanslı (CC0, CC BY, CC BY-SA) fotoğraflar.
// Gerçek yayından önce kendi çekimlerinle (ya da lisanslı video kütüphanesiyle) değiştirilir; kaynak ve lisans her görselin yanında yazılıdır.
// Kaynak listesi: assets/demo/credits.json. CC BY / CC BY-SA gereği yazar ve lisans kart ekranında gösterilir.
import type { ImageSourcePropType } from 'react-native';

export const DEMO_IMAGES: Record<string, ImageSourcePropType> = {
  hip: require('../../../assets/demo/hip.jpg'),
  legs: require('../../../assets/demo/legs.jpg'),
  chest: require('../../../assets/demo/chest.jpg'),
  back: require('../../../assets/demo/back.jpg'),
  shoulder: require('../../../assets/demo/shoulder.jpg'),
  arms: require('../../../assets/demo/arms.jpg'),
  core: require('../../../assets/demo/core.jpg'),
  fullbody: require('../../../assets/demo/fullbody.jpg'),
  posture: require('../../../assets/demo/posture.jpg'),
  yoga: require('../../../assets/demo/yoga.jpg'),
  pilates: require('../../../assets/demo/pilates.jpg'),
  cardio: require('../../../assets/demo/cardio.jpg'),
  mobility: require('../../../assets/demo/mobility.jpg'),
  sport: require('../../../assets/demo/sport.jpg'),
  face: require('../../../assets/demo/face.jpg'),
};

// Hareketin çalıştırdığı bölgeye göre demo görsel anahtarı (görsel yoksa kategoriye göre)
export function heroFor(item: { category: string; primary: string[] }): string {
  const p = item.primary.join(' ').toLocaleLowerCase('tr');
  if (/kalça/.test(p)) return 'hip';
  if (/bacak|baldır/.test(p)) return 'legs';
  if (/göğüs/.test(p)) return 'chest';
  if (/sırt|kürek/.test(p)) return 'back';
  if (/omuz/.test(p)) return 'shoulder';
  if (/kol|bisep|trisep/.test(p)) return 'arms';
  if (/karın|core|bel/.test(p)) return 'core';
  return ({ posture: 'posture', cardio: 'cardio', mobility: 'mobility', fitness: 'legs' } as Record<string, string>)[item.category] ?? 'fullbody';
}

export const DEMO_CREDITS: Record<string, { author: string; license: string; page: string }> = {
  hip: { author: 'Nenad Stojkovic', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Woman_doing_squat_workout_in_gym_with_barbell,_back_view.jpg' },
  legs: { author: 'PTPioneer', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:TRX_exercise_Squat_2.jpg' },
  chest: { author: 'Uzltt123', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Push-up.jpg' },
  back: { author: 'Shixart1985', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Woman_lifting_pink_dumbbells_during_an_indoor_workout_session_in_a_bright,_spacious_room_while_focusing_on_fitness_and_strength_training.jpg' },
  shoulder: { author: 'Shixart1985', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Woman_lifting_pink_dumbbells_during_a_workout_in_a_bright_indoor_space_with_soft_lighting.jpg' },
  arms: { author: 'Shixart1985', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Fitness_enthusiast_lifts_vibrant_dumbbell_during_home_workout.jpg' },
  core: { author: 'PTPioneer', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Personal_training_plank_exercise_instruction.jpg' },
  fullbody: { author: 'Shixart1985', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Woman_exercising_with_dumbbell_in_a_bright_living.jpg' },
  posture: { author: 'PTPioneer', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Personal_training_tricep_stretches.jpg' },
  yoga: { author: 'Andressa Voltolini desnorteeu', license: 'CC0', page: 'https://commons.wikimedia.org/wiki/File:Woman_yoga_pose_sunrise_(Unsplash).jpg' },
  pilates: { author: 'Shixart1985', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Back_view_of_a_woman_performing_a_stretching_exercise_for_the_spine.jpg' },
  cardio: { author: 'Joseph Sly1015', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Running_to_exercise.jpg' },
  mobility: { author: 'Nenad Stojkovic', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Woman_on_the_yoga_mat_stretching_her_hamstrings_-_50398044188.jpg' },
  sport: { author: 'Kiet Le', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:HIIT_Workout.jpg' },
  face: { author: 'Alvinategyeka', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Emotions_Spa_Facial_Massage_Parlour.jpg' },
};
