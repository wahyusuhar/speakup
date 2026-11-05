import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getDb } from '@/db/client';
import { getTranscript, listSessions, type EndReason, type SessionSummary, type TurnInput } from '@/db/repos/sessions';

// Minimal history (Phase 4): saved calls and their transcripts. Reports come in Phase 6/7.

const END_REASON_TEXT: Record<EndReason, string> = {
  user_hangup: 'ditutup',
  timeout: 'waktu habis',
  error: 'terputus',
  quota: 'kuota habis',
};

const MODE_TEXT = { placement: 'Tes level', lesson: 'Pelajaran', free: 'Bebas' } as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDuration(sec: number | null): string {
  if (sec === null) return '-';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} mnt ${s} dtk` : `${s} dtk`;
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [turns, setTurns] = useState<TurnInput[]>([]);

  useEffect(() => {
    getDb()
      .then((db) => listSessions(db))
      .then(setSessions)
      .catch(() => setFailed(true));
  }, []);

  const toggle = async (id: number) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setTurns([]);
    try {
      setTurns(await getTranscript(await getDb(), id));
    } catch {
      setTurns([]);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Riwayat Telepon</Text>
      <Link href="/" style={styles.link}>
        Kembali ke beranda
      </Link>

      {failed ? <Text style={styles.muted}>Riwayat tidak bisa dibuka.</Text> : null}
      {sessions === null && !failed ? <Text style={styles.muted}>Memuat…</Text> : null}
      {sessions?.length === 0 ? <Text style={styles.muted}>Belum ada telepon yang tersimpan.</Text> : null}

      {sessions?.map((s) => (
        <View key={s.id} style={styles.card}>
          <Pressable onPress={() => toggle(s.id)} accessibilityRole="button">
            <Text style={styles.cardTitle}>
              {formatDate(s.startedAt)} · {MODE_TEXT[s.mode]}
            </Text>
            <Text style={styles.cardMeta}>
              Durasi {formatDuration(s.durationSec)}
              {s.endReason ? ` · ${END_REASON_TEXT[s.endReason]}` : ''}
              {'  '}
              {openId === s.id ? '▲ tutup teks' : '▼ lihat teks'}
            </Text>
          </Pressable>
          {openId === s.id ? (
            <View style={styles.transcript}>
              {turns.length === 0 ? <Text style={styles.muted}>Tidak ada teks percakapan.</Text> : null}
              {turns.map((t, i) => (
                <Text key={i} style={styles.turn}>
                  <Text style={styles.speaker}>{t.speaker === 'user' ? 'Kamu: ' : 'Miss Rina: '}</Text>
                  {t.text}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: '#111827' },
  link: { color: '#2563EB', fontSize: 15 },
  muted: { color: '#6B7280', fontSize: 14 },
  card: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, gap: 8, backgroundColor: '#FFFFFF' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardMeta: { fontSize: 13, color: '#4B5563', marginTop: 2 },
  transcript: { gap: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8 },
  turn: { fontSize: 14, color: '#111827', lineHeight: 20 },
  speaker: { fontWeight: '700' },
});
