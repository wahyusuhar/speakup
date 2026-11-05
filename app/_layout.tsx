import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useProfileStore } from '@/store/profileStore';

type InitState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export default function RootLayout() {
  const loadProfile = useProfileStore((s) => s.load);
  const [init, setInit] = useState<InitState>({ status: 'loading' });

  // Opens the database (runs migrations) and loads the profile before any screen renders.
  const load = useCallback(() => {
    loadProfile()
      .then(() => setInit({ status: 'ready' }))
      .catch((e: unknown) => setInit({ status: 'error', message: e instanceof Error ? e.message : String(e) }));
  }, [loadProfile]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setInit({ status: 'loading' });
    load();
  };

  if (init.status !== 'ready') {
    return (
      <View style={styles.center}>
        <StatusBar style="auto" />
        {init.status === 'loading' ? (
          <>
            <ActivityIndicator />
            <Text style={styles.text}>Menyiapkan data…</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Data tidak bisa dibuka</Text>
            <Text style={styles.text}>
              Database lokal gagal dibuka. Jika memakai browser, pastikan penyimpanan situs tidak diblokir.
            </Text>
            <Text style={styles.detail}>Detail: {init.message}</Text>
            <Pressable onPress={retry} style={styles.button}>
              <Text style={styles.buttonText}>Coba lagi</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#FFFFFF' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  text: { fontSize: 15, color: '#4B5563', textAlign: 'center', maxWidth: 420 },
  detail: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  button: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  buttonText: { color: '#FFFFFF', fontWeight: '600' },
});
