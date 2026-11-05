import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import { CALL_DURATION_MIN, CALL_WARNING_MIN } from '@/config/models';
import { STARTER_LESSON_MIN_SEC } from '@/config/starterLessons';
import { getDb } from '@/db/client';
import { SESSION_MODES, countSessions, saveCallSession, type SessionMode } from '@/db/repos/sessions';
import {
  useLiveCall,
  type CallEndRecord,
  type CallError,
  type CallStatus,
  type TranscriptTurn,
} from '@/live/useLiveCall';
import { WRAP_UP_CUE, resolveIndonesianSupport } from '@/prompts/blocks';
import {
  buildStarterCallPrompt,
  pickStarterLesson,
  plannedCallMinutes,
  wrapUpCueAtSec,
} from '@/prompts/starterCall';
import { useProfileStore } from '@/store/profileStore';

// Call screen. mode: placement | lesson | free
// Until Phase 5/6 every mode uses the temporary guided starterCall prompt with a built-in lesson.

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

function toMode(value: string | undefined): SessionMode {
  return SESSION_MODES.find((m) => m === value) ?? 'free';
}

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

function Bubble({ turn, live = false }: { turn: TranscriptTurn; live?: boolean }) {
  const isUser = turn.speaker === 'user';
  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleTutor, live && styles.bubbleLive]}>
      <Text style={styles.bubbleSpeaker}>
        {isUser ? 'Kamu' : 'Miss Rina'}
        {turn.interrupted ? ' · terpotong' : ''}
        {live ? ' · …' : ''}
      </Text>
      <Text style={styles.bubbleText}>{turn.text}</Text>
    </View>
  );
}

export default function CallScreen() {
  const params = useLocalSearchParams<{ mode: string }>();
  const mode = toMode(params.mode);
  const profile = useProfileStore((s) => s.profile);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  /** Earlier calls long enough to count as a finished starter lesson; null while loading. */
  const [lessonsDone, setLessonsDone] = useState<number | null>(null);

  const refreshLessonsDone = useCallback(() => {
    getDb()
      .then((db) => countSessions(db, { mode, minDurationSec: STARTER_LESSON_MIN_SEC }))
      .then(setLessonsDone)
      .catch((e: unknown) => {
        console.warn('[call] failed to count sessions', e);
        setLessonsDone(0);
      });
  }, [mode]);

  useEffect(refreshLessonsDone, [refreshLessonsDone]);

  const support = profile ? resolveIndonesianSupport(profile) : 'full';
  const lesson = useMemo(() => pickStarterLesson(support, lessonsDone ?? 0), [support, lessonsDone]);

  const onCallEnded = (record: CallEndRecord) => {
    setSaveState('saving');
    getDb()
      .then((db) => saveCallSession(db, { ...record, mode, unitId: null }))
      .then(() => {
        setSaveState('saved');
        refreshLessonsDone();
      })
      .catch((e: unknown) => {
        console.warn('[call] failed to save session', e);
        setSaveState('failed');
      });
  };

  const { status, tutorSpeaking, elapsedSec, error, transcript, liveText, start, hangUp } = useLiveCall({
    onCallEnded,
  });
  const inCall = status === 'connecting' || status === 'active';
  const scrollRef = useRef<ScrollViewInstance>(null);

  if (!profile) return <Redirect href="/onboarding" />;

  const startCall = () => {
    if (lessonsDone === null) return;
    setSaveState('idle');
    const minutes = plannedCallMinutes(profile.dailyMinutes);
    void start({
      systemInstruction: buildStarterCallPrompt({ addressAs: profile.addressAs, support, minutes, lesson }),
      wrapUpCue: { atSec: wrapUpCueAtSec(minutes), text: WRAP_UP_CUE },
    });
  };

  const liveUser = liveText.user.trim();
  const liveTutor = liveText.tutor.trim();
  const hasText = transcript.length > 0 || liveUser !== '' || liveTutor !== '';
  const remainingSec = CALL_DURATION_MIN * 60 - elapsedSec;
  const showWarning = status === 'active' && elapsedSec >= CALL_WARNING_MIN * 60;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>R</Text>
        </View>
        <Text style={styles.name}>Miss Rina</Text>
        <Text style={styles.mode}>Pelajaran: {lessonsDone === null ? '…' : lesson.title}</Text>
        <Text style={styles.status}>{statusText(status, tutorSpeaking)}</Text>
        <Text style={styles.timer}>{formatTime(elapsedSec)}</Text>
        {showWarning ? (
          <Text style={styles.warning}>Telepon berakhir otomatis dalam {formatTime(Math.max(0, remainingSec))}</Text>
        ) : null}
        {saveState === 'saving' ? <Text style={styles.saveNote}>Menyimpan percakapan…</Text> : null}
        {saveState === 'saved' ? <Text style={styles.saveNote}>Percakapan tersimpan.</Text> : null}
        {saveState === 'failed' ? (
          <Text style={styles.saveFailed}>Gagal menyimpan percakapan di perangkat ini.</Text>
        ) : null}

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
          onPress={inCall ? hangUp : startCall}
          style={[styles.callButton, inCall ? styles.hangUp : styles.call]}
          accessibilityRole="button"
        >
          <Text style={styles.callButtonText}>{inCall ? 'Tutup' : 'Telepon'}</Text>
        </Pressable>
        {!inCall ? (
          <Link href="/" style={styles.link}>
            Kembali ke beranda
          </Link>
        ) : null}
      </View>

      <View style={styles.transcriptPanel}>
        <Text style={styles.transcriptTitle}>Teks percakapan</Text>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.transcriptContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {hasText ? null : (
            <Text style={styles.placeholder}>Teks percakapan akan muncul di sini selama telepon.</Text>
          )}
          {transcript.map((turn, i) => (
            <Bubble key={i} turn={turn} />
          ))}
          {liveUser ? <Bubble turn={{ speaker: 'user', text: liveUser }} live /> : null}
          {liveTutor ? <Bubble turn={{ speaker: 'tutor', text: liveTutor }} live /> : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  header: { alignItems: 'center', gap: 4, paddingTop: 16 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { color: '#FFFFFF', fontSize: 30, fontWeight: '700' },
  name: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  mode: { color: '#94A3B8', fontSize: 12 },
  status: { color: '#E2E8F0', fontSize: 16, marginTop: 8 },
  timer: { color: '#FFFFFF', fontSize: 32, fontVariant: ['tabular-nums'] },
  warning: { color: '#FDE68A', fontSize: 14 },
  saveNote: { color: '#86EFAC', fontSize: 13 },
  saveFailed: { color: '#FCA5A5', fontSize: 13 },
  errorBox: { backgroundColor: '#7F1D1D', borderRadius: 8, padding: 12, maxWidth: 420, gap: 4, marginTop: 8 },
  errorText: { color: '#FFFFFF', fontSize: 15 },
  errorDetail: { color: '#FECACA', fontSize: 12 },
  callButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  call: { backgroundColor: '#16A34A' },
  hangUp: { backgroundColor: '#DC2626' },
  callButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  link: { color: '#93C5FD', fontSize: 14, marginTop: 8 },
  transcriptPanel: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
  },
  transcriptTitle: { color: '#94A3B8', fontSize: 12, marginBottom: 8 },
  transcriptContent: { gap: 8, paddingBottom: 8 },
  placeholder: { color: '#64748B', fontSize: 14 },
  bubble: { borderRadius: 10, padding: 10, maxWidth: '90%' },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: '#1D4ED8' },
  bubbleTutor: { alignSelf: 'flex-start', backgroundColor: '#334155' },
  bubbleLive: { opacity: 0.7 },
  bubbleSpeaker: { color: '#CBD5E1', fontSize: 11, marginBottom: 2 },
  bubbleText: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
});
