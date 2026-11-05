import { Link, Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useProfileStore } from '@/store/profileStore';

// Home screen. Sends first-time users to onboarding.
// Phase 5 adds "Pelajaran hari ini"; Phase 6b adds the progress summary.
export default function HomeScreen() {
  const profile = useProfileStore((s) => s.profile);

  if (!profile) return <Redirect href="/onboarding" />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Halo, {profile.addressAs}!</Text>
      <Text style={styles.subtitle}>Guru privat bahasa Inggris kamu siap ditelepon.</Text>

      <Link href="/call/free" style={[styles.button, styles.primary]}>
        Telepon Guru
      </Link>
      <Link href="/history" style={[styles.button, styles.secondary]}>
        Riwayat Telepon
      </Link>
      <Link href="/onboarding" style={[styles.button, styles.secondary]}>
        Ubah Profil
      </Link>
      <Link href="/onboarding/api-key" style={[styles.button, styles.secondary]}>
        Atur API Key
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    minWidth: 220,
    textAlign: 'center',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: '600',
    overflow: 'hidden',
  },
  primary: { backgroundColor: '#16A34A', color: '#FFFFFF' },
  secondary: { backgroundColor: '#F3F4F6', color: '#111827' },
});
