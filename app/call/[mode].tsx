import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';

// Call screen. mode: placement | lesson | free
// TODO(Fase 2–3): implement call UI via useLiveCall.
export default function CallScreen() {
  const { mode } = useLocalSearchParams<{ mode: string }>();
  return <PlaceholderScreen title="Telepon Guru" note={`Mode: ${mode ?? '-'}`} />;
}
