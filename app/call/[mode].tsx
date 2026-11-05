import { Link, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLiveCall, type CallError, type CallStatus } from '@/live/useLiveCall';

// Minimal call screen (Phase 2). mode: placement | lesson | free
// Phase 2 uses the temporary prototype prompt for every mode.

const ERROR_TEXT: Record<CallError['code'], string> = {
  no_api_key: 'API key belum diatur.',
  mic_permission: 'Izin mikrofon ditolak. Izinkan mikrofon untuk situs ini di pengaturan browser, lalu coba lagi.',
  mic_unavailable: 'Mikrofon tidak ditemukan. Sambungkan mikrofon atau earphone, lalu coba lagi.',
  audio_unsupported: 'Perangkat atau browser ini tidak mendukung audio yang dibutuhkan. Coba Chrome atau Edge terbaru.',
  connect_failed: 'Gagal tersambung ke guru. Periksa API key, kuota, dan koneksi internet.',
  connection_lost: 'Sambungan dengan guru terputus.',
};

function statusText(status: CallStatus, tutorSpeaking: boolean): string {
  switch (status) {
    case 'idle':
      return 'Siap menelepon';
    case 'connecting':
      return 'Menyambungkan…';
    case 'active':
      return tutorSpeaking ? 'Guru berbicara' : 'Mendengarkan';
    case 'ended':
      return 'Telepon selesai';
    case 'error':
      return 'Telepon gagal';
  }
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CallScreen() {
  const { mode } = useLocalSearchParams<{ mode: string }>();
  const { status, tutorSpeaking, elapsedSec, error, start, hangUp } = useLiveCall();
  const inCall = status === 'connecting' || status === 'active';

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>R</Text>
      </View>
      <Text style={styles.name}>Miss Rina</Text>
      <Text style={styles.mode}>Mode: {mode ?? '-'}</Text>

      <Text style={styles.status}>{statusText(status, tutorSpeaking)}</Text>
      <Text style={styles.timer}>{formatTime(elapsedSec)}</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{ERROR_TEXT[error.code]}</Text>
          {error.detail ? <Text style={styles.errorDetail}>Detail: {error.detail}</Text> : null}
          {error.code === 'no_api_key' ? (
            <Link href="/onboarding/api-key" style={styles.link}>
              Atur API key
            </Link>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={inCall ? hangUp : start}
        style={[styles.callButton, inCall ? styles.hangUp : styles.call]}
        accessibilityRole="button"
      >
        <Text style={styles.callButtonText}>{inCall ? 'Tutup' : 'Telepon'}</Text>
      </Pressable>

      <Text style={styles.tip}>Tips: pakai earphone agar suara guru tidak terekam ulang oleh mikrofon.</Text>

      {!inCall ? (
        <Link href="/" style={styles.link}>
          Kembali ke beranda
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    padding: 24,
    gap: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: { color: '#FFFFFF', fontSize: 40, fontWeight: '700' },
  name: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  mode: { color: '#94A3B8', fontSize: 13 },
  status: { color: '#E2E8F0', fontSize: 18, marginTop: 16 },
  timer: { color: '#FFFFFF', fontSize: 40, fontVariant: ['tabular-nums'], marginBottom: 16 },
  errorBox: {
    backgroundColor: '#7F1D1D',
    borderRadius: 8,
    padding: 12,
    maxWidth: 420,
    gap: 4,
  },
  errorText: { color: '#FFFFFF', fontSize: 15 },
  errorDetail: { color: '#FECACA', fontSize: 12 },
  callButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  call: { backgroundColor: '#16A34A' },
  hangUp: { backgroundColor: '#DC2626' },
  callButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  tip: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 24, maxWidth: 360 },
  link: { color: '#93C5FD', fontSize: 15, marginTop: 8 },
});
