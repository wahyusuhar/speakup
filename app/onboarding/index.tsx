import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DAILY_MINUTE_OPTIONS, GOAL_OPTIONS, SELF_ASSESSMENT_LABELS } from '@/content/labels';
import { SELF_ASSESSMENTS, type SelfAssessment } from '@/db/repos/profile';
import { apiKeyStore } from '@/storage/apiKeyStore';
import { useProfileStore } from '@/store/profileStore';

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const existing = useProfileStore((s) => s.profile);
  const save = useProfileStore((s) => s.saveOnboarding);

  const [addressAs, setAddressAs] = useState(existing?.addressAs ?? '');
  const [selfAssessment, setSelfAssessment] = useState<SelfAssessment | null>(existing?.selfAssessment ?? null);
  const [goals, setGoals] = useState<string[]>(existing?.goals ?? []);
  const [dailyMinutes, setDailyMinutes] = useState<number>(existing?.dailyMinutes ?? 15);
  const [privacyOk, setPrivacyOk] = useState(existing !== null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleGoal = (key: string) =>
    setGoals((g) => (g.includes(key) ? g.filter((x) => x !== key) : [...g, key]));

  const submit = async () => {
    if (!addressAs.trim()) return setError('Isi nama sapaan dulu.');
    if (!selfAssessment) return setError('Pilih perkiraan kemampuan bahasa Inggris kamu.');
    if (goals.length === 0) return setError('Pilih minimal satu tujuan belajar.');
    if (!privacyOk) return setError('Centang dulu bahwa kamu sudah membaca catatan privasi.');
    setError(null);
    setSaving(true);
    try {
      await save({ addressAs, selfAssessment, goals, dailyMinutes });
      const key = await apiKeyStore.getApiKey().catch(() => null);
      router.replace(key ? '/' : '/onboarding/api-key');
    } catch {
      setError('Gagal menyimpan profil. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{existing ? 'Ubah Profil' : 'Kenalan Dulu'}</Text>
      <Text style={styles.body}>Data ini membantu guru menyesuaikan pelajaran. Semua tersimpan di perangkat ini.</Text>

      <Text style={styles.label}>Guru memanggil kamu dengan nama</Text>
      <TextInput
        value={addressAs}
        onChangeText={setAddressAs}
        placeholder="mis. Mas Wahyu"
        maxLength={40}
        style={styles.input}
      />

      <Text style={styles.label}>Perkiraan kemampuan bahasa Inggris kamu</Text>
      <View style={styles.row}>
        {SELF_ASSESSMENTS.map((s) => (
          <Chip
            key={s}
            label={SELF_ASSESSMENT_LABELS[s]}
            selected={selfAssessment === s}
            onPress={() => setSelfAssessment(s)}
          />
        ))}
      </View>

      <Text style={styles.label}>Tujuan belajar (boleh lebih dari satu)</Text>
      <View style={styles.row}>
        {GOAL_OPTIONS.map((g) => (
          <Chip key={g.key} label={g.label} selected={goals.includes(g.key)} onPress={() => toggleGoal(g.key)} />
        ))}
      </View>

      <Text style={styles.label}>Target belajar per hari</Text>
      <View style={styles.row}>
        {DAILY_MINUTE_OPTIONS.map((m) => (
          <Chip key={m} label={`${m} menit`} selected={dailyMinutes === m} onPress={() => setDailyMinutes(m)} />
        ))}
      </View>

      <View style={styles.privacy}>
        <Text style={styles.privacyTitle}>Catatan privasi</Text>
        <Text style={styles.privacyText}>
          Suara dan teks percakapan dikirim ke Google Gemini (layanan gratis). Google dapat memakai data layanan gratis
          untuk mengembangkan produknya. Jangan menyebut data pribadi sensitif (nomor KTP, rekening, alamat lengkap,
          kata sandi) saat menelepon. Audio tidak disimpan di aplikasi; hanya teks percakapan yang disimpan di
          perangkat ini.
        </Text>
        <Pressable onPress={() => setPrivacyOk((v) => !v)} style={styles.checkRow} accessibilityRole="checkbox">
          <View style={[styles.checkbox, privacyOk && styles.checkboxOn]}>
            {privacyOk ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkLabel}>Saya mengerti</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={submit} disabled={saving} style={[styles.button, saving && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>{saving ? 'Menyimpan…' : 'Simpan'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48, gap: 10, backgroundColor: '#FFFFFF', maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: '#111827' },
  body: { fontSize: 15, color: '#4B5563', marginBottom: 8 },
  label: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#111827', fontSize: 14 },
  chipTextSelected: { color: '#FFFFFF' },
  privacy: { backgroundColor: '#FEF3C7', borderRadius: 8, padding: 12, gap: 8, marginTop: 16 },
  privacyTitle: { fontWeight: '700', color: '#92400E' },
  privacyText: { color: '#78350F', fontSize: 14, lineHeight: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#92400E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#92400E' },
  checkMark: { color: '#FFFFFF', fontWeight: '700' },
  checkLabel: { color: '#78350F', fontWeight: '600' },
  error: { color: '#B91C1C', fontSize: 14, marginTop: 8 },
  button: { backgroundColor: '#16A34A', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
