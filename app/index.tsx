import { StyleSheet, Text, View } from 'react-native';

// Home screen. Phase 1: placeholder only.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hello SpeakUp</Text>
      <Text style={styles.subtitle}>Guru privat bahasa Inggris kamu.</Text>
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
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#4B5563',
  },
});
