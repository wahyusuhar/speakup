import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { apiKeyStore } from '@/storage/apiKeyStore';

// The key is never rendered back, logged, or sent anywhere except the Gemini API.
export default function ApiKeyScreen() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiKeyStore
      .getApiKey()
      .then((k) => setHasKey(Boolean(k)))
      .catch(() => setHasKey(false));
  }, []);

  const save = async () => {
    const key = input.trim();
    if (key.length < 20) {
      setMessage('API key terlalu pendek. Salin lengkap dari Google AI Studio.');
      return;
    }
    try {
      await apiKeyStore.setApiKey(key);
      setInput('');
      setHasKey(true);
      setMessage('API key tersimpan di perangkat ini.');
    } catch {
      setMessage('Gagal menyimpan API key. Pastikan penyimpanan browser tidak diblokir.');
    }
  };

  const clear = async () => {
    await apiKeyStore.clearApiKey();
    setHasKey(false);
    setMessage('API key dihapus dari perangkat ini.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>API Key Gemini</Text>
      <Text style={styles.body}>
        Buat API key gratis di Google AI Studio (aistudio.google.com), lalu tempel di sini. Key hanya disimpan
        di perangkat ini dan tidak dikirim ke server mana pun selain Google.
      </Text>

      <Text style={styles.status}>
        Status: {hasKey === null ? 'memeriksa…' : hasKey ? 'API key sudah tersimpan' : 'belum ada API key'}
      </Text>

      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder="Tempel API key di sini"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        style={styles.input}
      />

      <Pressable onPress={save} style={[styles.button, styles.primary]}>
        <Text style={styles.primaryText}>Simpan</Text>
      </Pressable>

      {hasKey ? (
        <Pressable onPress={clear} style={[styles.button, styles.secondary]}>
          <Text style={styles.secondaryText}>Hapus API key</Text>
        </Pressable>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Link href="/" style={[styles.link, styles.linkWrap]}>
        Kembali ke beranda
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64, backgroundColor: '#FFFFFF', gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  body: { fontSize: 15, color: '#4B5563', lineHeight: 22 },
  status: { fontSize: 14, color: '#111827', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  button: { borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  primary: { backgroundColor: '#2563EB' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  secondary: { backgroundColor: '#F3F4F6' },
  secondaryText: { color: '#B91C1C', fontSize: 15, fontWeight: '600' },
  message: { fontSize: 14, color: '#374151' },
  linkWrap: { marginTop: 8 },
  link: { color: '#2563EB', fontSize: 15 },
});
