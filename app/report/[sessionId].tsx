import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';

// TODO(Fase 6): render session report.
export default function ReportScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return <PlaceholderScreen title="Laporan Sesi" note={`Sesi #${sessionId ?? '-'}`} />;
}
