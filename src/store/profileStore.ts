// Global learner profile state (zustand), backed by the learner_profile table.
import { create } from 'zustand';

import { getDb } from '@/db/client';
import { getProfile, saveOnboarding, type LearnerProfile, type OnboardingInput } from '@/db/repos/profile';

type ProfileState = {
  profile: LearnerProfile | null;
  loaded: boolean;
  load: () => Promise<void>;
  saveOnboarding: (input: OnboardingInput) => Promise<void>;
};

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loaded: false,
  load: async () => {
    const db = await getDb();
    set({ profile: await getProfile(db), loaded: true });
  },
  saveOnboarding: async (input) => {
    const db = await getDb();
    await saveOnboarding(db, input);
    set({ profile: await getProfile(db), loaded: true });
  },
}));
