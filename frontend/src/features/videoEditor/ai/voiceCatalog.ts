import type { VoiceOption } from './aiService';

/** Use-case groups for the voice picker, matched on the voice's one-word character. */
export const VOICE_CATEGORIES: { id: string; label: string; traits: string[] }[] = [
  { id: 'commercial', label: 'Commercial voiceover', traits: ['upbeat', 'bright', 'excitable', 'lively', 'forward'] },
  { id: 'narration', label: 'Narration & storytelling', traits: ['informative', 'mature', 'gravelly', 'even', 'smooth'] },
  { id: 'tutor', label: 'Tutor & instructional', traits: ['clear', 'knowledgeable', 'firm'] },
  { id: 'calm', label: 'Calm & soothing', traits: ['soft', 'gentle', 'breathy', 'warm', 'breezy'] },
  { id: 'casual', label: 'Casual & friendly', traits: ['friendly', 'casual', 'easy-going', 'youthful'] },
];
export const OTHER_CATEGORY = { id: 'other', label: 'More voices' };

/** Genders of AI Studio's prebuilt voices, for when the server's list doesn't say. */
const GENDERS: Record<string, 'female' | 'male'> = {
  Zephyr: 'female', Puck: 'male', Charon: 'male', Kore: 'female', Fenrir: 'male', Leda: 'female', Orus: 'male', Aoede: 'female',
  Callirrhoe: 'female', Autonoe: 'female', Enceladus: 'male', Iapetus: 'male', Umbriel: 'male', Algieba: 'male', Despina: 'female',
  Erinome: 'female', Algenib: 'male', Rasalgethi: 'male', Laomedeia: 'female', Achernar: 'female', Alnilam: 'male', Schedar: 'male',
  Gacrux: 'female', Pulcherrima: 'female', Achird: 'male', Zubenelgenubi: 'male', Vindemiatrix: 'female', Sadachbia: 'male',
  Sadaltager: 'male', Sulafat: 'female',
};

export function voiceGender(v: VoiceOption): 'female' | 'male' | null {
  const g = v.gender?.toLowerCase();
  if (g === 'female' || g === 'male') return g;
  return GENDERS[v.id] ?? null;
}

export function voiceCategory(v: VoiceOption): string {
  const trait = v.description.trim().toLowerCase();
  return VOICE_CATEGORIES.find((c) => c.traits.some((t) => trait.startsWith(t)))?.id ?? OTHER_CATEGORY.id;
}

const FAVORITES_KEY = 've-favorite-voices';

export function loadFavorites(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveFavorites(ids: string[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  } catch {
    // Private mode or full storage: favourites just don't persist.
  }
}
