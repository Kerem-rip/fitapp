import { inQuietHours, lockScreenText, prefKeyOf, SOCIAL_TYPES, turkeyHour } from './notify-rules.js';

describe('bildirim kuralları', () => {
  it('tür → tercih eşleşmesi; moderasyon bildirimi kapatılamaz', () => {
    expect(prefKeyOf('social_follow_request')).toBe('follows');
    expect(prefKeyOf('social_reply')).toBe('comments');
    expect(prefKeyOf('social_story_mention')).toBe('mentions');
    expect(prefKeyOf('social_story_reaction')).toBe('stories');
    expect(prefKeyOf('moderation_removed')).toBeNull();
    expect(prefKeyOf('appointment_created')).toBeNull();
  });

  it('sessiz saatler gece yarısını aşabilir', () => {
    expect(inQuietHours(23, 23, 7)).toBe(true);
    expect(inQuietHours(3, 23, 7)).toBe(true);
    expect(inQuietHours(7, 23, 7)).toBe(false);
    expect(inQuietHours(12, 9, 18)).toBe(true);
    expect(inQuietHours(12, null, 7)).toBe(false);
    expect(inQuietHours(12, 5, 5)).toBe(false);
    expect(turkeyHour(new Date('2026-11-13T22:30:00Z'))).toBe(1);
  });

  it('kilit ekranı metni kişi adı ya da içerik taşımaz', () => {
    for (const t of [...SOCIAL_TYPES, 'dm_message', 'plan_published']) {
      const text = lockScreenText(t);
      expect(text.length).toBeGreaterThan(5);
      expect(text).not.toMatch(/@|kilo|kalori|ölçüm/i);
    }
  });
});
