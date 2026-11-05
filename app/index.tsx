import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

// Home screen. Phase 2: entry points for the call prototype.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hello SpeakUp</Text>
      <Text style={styles.subtitle}>Guru privat bahasa Inggris kamu.</Text>

      <Link href="/call/free" style={[styles.button, styles.primary]}>
        Telepon Guru
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
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 16,
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
