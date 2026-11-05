import { Ionicons } from '@expo/vector-icons';
import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { TranscriptPanel } from '@/components/call/TranscriptPanel';
import { TutorAvatar } from '@/components/call/TutorAvatar';
import { VoiceBars } from '@/components/call/VoiceBars';
import { formatClock, formatDelay, initialOf } from '@/components/call/format';
import { SELF_ASSESSMENT_LABELS } from '@/content/labels';
import { CALL_DURATION_MIN, CALL_WARNING_MIN } from '@/config/models';
import { STARTER_LESSON_MIN_SEC, type StarterLesson } from '@/config/starterLessons';
import { TUTOR_INITIAL, TUTOR_NAME, TUTOR_PHOTO } from '@/config/tutor';
import { getDb } from '@/db/client';
import { SESSION_MODES, countSessions, saveCallSession, type SessionMode } from '@/db/repos/sessions';
import { useLiveCall, type CallEndRecord, type CallError, type CallStatus, type TranscriptTurn } from '@/live/useLiveCall';
import { WRAP_UP_CUE, resolveIndonesianSupport } from '@/prompts/blocks';
import { buildStarterCallPrompt, pickStarterLesson, plannedCallMinutes, wrapUpCueAtSec } from '@/prompts/starterCall';
import { useProfileStore } from '@/store/profileStore';
import { breakpoints, colors, fonts, fontSize, layout, radius, shadows, space } from '@/theme/tokens';

// Call screen. mode: placement | lesson | free
// Until Phase 5/6 every mode uses the temporary guided starterCall prompt with a built-in lesson.
// Layout: two columns (call panel + transcript) on wide screens, one column on phones (doc/design/).

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

function toMode(value: string | undefined): SessionMode {
  return SESSION_MODES.find((m) => m === value) ?? 'free';
}

const MODE_LABELS: Record<SessionMode, string> = { free: 'Bebas', lesson: 'Pelajaran', placement: 'Cek level' };

const ERROR_TEXT: Record<CallError['code'], string> = {
  no_api_key: 'API key belum diatur.',
  mic_permission: 'Izin mikrofon ditolak. Izinkan mikrofon untuk situs ini di pengaturan browser, lalu coba lagi.',
  mic_unavailable: 'Mikrofon tidak ditemukan. Sambungkan mikrofon atau earphone, lalu coba lagi.',
  audio_unsupported: 'Perangkat atau browser ini tidak mendukung audio yang dibutuhkan. Coba Chrome atau Edge terbaru.',
  connect_failed: 'Gagal tersambung ke guru. Periksa API key, kuota, dan koneksi internet.',
  connection_lost: 'Sambungan dengan guru terputus.',
};

const STATUS_BADGE: Record<CallStatus, { label: string; color: string }> = {
  idle: { label: 'Siap', color: colors.textMuted },
  connecting: { label: 'Menyambungkan', color: colors.warning },
  active: { label: 'Sesi aktif', color: colors.emerald },
  ended: { label: 'Telepon selesai', color: colors.textMuted },
  error: { label: 'Telepon gagal', color: colors.danger },
};

function activityText(status: CallStatus, tutorSpeaking: boolean, muted: boolean): string {
  switch (status) {
    case 'idle':
      return 'Tekan Telepon untuk mulai belajar';
    case 'connecting':
      return `Menyambungkan ke ${TUTOR_NAME}…`;
    case 'active':
      if (muted) return 'Mikrofon kamu dimatikan';
      return tutorSpeaking ? `${TUTOR_NAME} sedang berbicara…` : `${TUTOR_NAME} sedang mendengarkan…`;
    case 'ended':
      return 'Telepon selesai';
    case 'error':
      return 'Telepon gagal';
  }
}

function lessonItems(lesson: StarterLesson): string[] {
  return lesson.parts.flatMap((p) => p.items.map((it) => it.en));
}

export default function CallScreen() {
  const params = useLocalSearchParams<{ mode: string }>();
  const mode = toMode(params.mode);
  const profile = useProfileStore((s) => s.profile);
  const { width, height } = useWindowDimensions();
  const wide = width >= breakpoints.wide;
  /** Short desktop windows (e.g. laptop with browser zoom): shrink the avatar and spacing. */
  const short = height < breakpoints.shortHeight;
  const avatarSize = height < 760 ? 132 : short ? 168 : 200;
  const [saveState, setSaveState] = useState<SaveState>('idle');
  /** Earlier calls long enough to count as a finished starter lesson; null while loading. */
  const [lessonsDone, setLessonsDone] = useState<number | null>(null);
  /** Lesson of the current/last call; the next lesson is only picked for the next call. */
  const [callLesson, setCallLesson] = useState<StarterLesson | null>(null);

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
  const nextLesson = useMemo(() => pickStarterLesson(support, lessonsDone ?? 0), [support, lessonsDone]);
  const shownLesson = callLesson ?? nextLesson;
  const englishItems = useMemo(() => lessonItems(shownLesson), [shownLesson]);

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

  const call = useLiveCall({ onCallEnded });
  const { status, tutorSpeaking, elapsedSec, error, transcript, liveText, muted, micLevel, responseDelayMs } = call;
  const inCall = status === 'connecting' || status === 'active';

  if (!profile) return <Redirect href="/onboarding" />;

  const startCall = () => {
    if (lessonsDone === null) return;
    setSaveState('idle');
    setCallLesson(nextLesson);
    const minutes = plannedCallMinutes(profile.dailyMinutes);
    void call.start({
      systemInstruction: buildStarterCallPrompt({
        addressAs: profile.addressAs,
        support,
        minutes,
        lesson: nextLesson,
        now: new Date(),
      }),
      wrapUpCue: { atSec: wrapUpCueAtSec(minutes), text: WRAP_UP_CUE },
    });
  };

  const liveTurns: TranscriptTurn[] = (['user', 'tutor'] as const)
    .map((speaker) => ({ speaker, text: liveText[speaker].text.trim(), atSec: liveText[speaker].atSec }))
    .filter((t) => t.text !== '');

  const remainingSec = CALL_DURATION_MIN * 60 - elapsedSec;
  const showWarning = status === 'active' && elapsedSec >= CALL_WARNING_MIN * 60;
  const badge = STATUS_BADGE[status];
  const barsSource = status !== 'active' ? 'idle' : tutorSpeaking ? 'tutor' : muted ? 'idle' : 'student';
  const levelLabel = profile.cefrLevel ?? SELF_ASSESSMENT_LABELS[profile.selfAssessment];

  // ---- Shared pieces -------------------------------------------------------------------------

  const notices = (
    <>
      {showWarning ? (
        <Text style={styles.warning}>Telepon berakhir otomatis dalam {formatClock(Math.max(0, remainingSec))}</Text>
      ) : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{ERROR_TEXT[error.code]}</Text>
          {error.detail ? <Text style={styles.errorDetail}>Detail: {error.detail}</Text> : null}
          {error.code === 'no_api_key' ? (
            <Link href="/onboarding/api-key" style={styles.inlineLink}>
              Atur API key
            </Link>
          ) : null}
        </View>
      ) : null}
    </>
  );

  const saveNote =
    saveState === 'idle' ? null : (
      <View style={styles.saveRow}>
        {saveState === 'saved' ? <Ionicons name="checkmark" size={13} color={colors.primary} /> : null}
        <Text style={saveState === 'failed' ? styles.saveFailed : styles.saveNote}>
          {saveState === 'saving'
            ? 'Menyimpan percakapan…'
            : saveState === 'saved'
              ? 'Percakapan tersimpan'
              : 'Gagal menyimpan percakapan di perangkat ini'}
        </Text>
      </View>
    );

  const micBadge = inCall ? (
    <View style={[styles.micBadge, muted && styles.micBadgeMuted, !wide && styles.micBadgeSmall]}>
      <Ionicons name={muted ? 'mic-off' : 'mic'} size={wide ? 16 : 14} color={muted ? colors.textStrong : colors.onPrimary} />
    </View>
  ) : null;

  const muteButton = inCall ? (
    <Pressable
      onPress={call.toggleMute}
      style={({ pressed }) => [wide ? styles.squareButton : styles.roundButton, pressed && styles.pressed, muted && styles.mutedButton]}
      accessibilityRole="button"
      accessibilityLabel={muted ? 'Nyalakan mikrofon' : 'Matikan mikrofon'}
      accessibilityState={{ selected: muted }}
    >
      <Ionicons name={muted ? 'mic-off' : 'mic-outline'} size={20} color={muted ? colors.dangerText : colors.textSoft} />
    </Pressable>
  ) : null;

  const mainButton = (
    <Pressable
      onPress={inCall ? call.hangUp : startCall}
      disabled={!inCall && lessonsDone === null}
      style={({ pressed }) => [
        wide ? styles.mainButtonWide : styles.mainButtonPhone,
        inCall ? styles.hangUp : wide ? styles.callStartWide : styles.callStartPhone,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <Ionicons
        name="call"
        size={wide ? 20 : 22}
        color={inCall || wide ? colors.textStrong : colors.onPrimary}
        style={inCall ? styles.hangUpIcon : undefined}
      />
      <Text style={[styles.mainButtonText, !wide && !inCall && styles.mainButtonTextDark, !wide && styles.mainButtonTextPhone]}>
        {inCall ? 'Tutup' : 'Telepon'}
      </Text>
    </Pressable>
  );

  const transcriptPanel = (
    <TranscriptPanel
      turns={transcript}
      liveTurns={liveTurns}
      englishItems={englishItems}
      tutorName={TUTOR_NAME}
      compact={!wide}
    />
  );

  // ---- Desktop -------------------------------------------------------------------------------

  if (wide) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerInner}>
            <View style={styles.brand}>
              <View style={styles.brandTile}>
                <Ionicons name="pulse" size={22} color={colors.primary} />
              </View>
              <View>
                <View style={styles.brandRow}>
                  <Text style={styles.brandName}>{TUTOR_NAME}</Text>
                  <Text style={styles.brandTag}>GURU AI</Text>
                </View>
                <Text style={styles.brandMode}>
                  Mode: <Text style={styles.brandModeValue}>{MODE_LABELS[mode]}</Text>
                </Text>
              </View>
            </View>

            {responseDelayMs !== null ? (
              <View style={styles.metricPill} accessibilityLabel="Jeda jawaban terakhir yang diukur">
                <Ionicons name="flash-outline" size={14} color={colors.cyan} />
                <Text style={styles.metricText}>
                  Jeda jawaban: <Text style={styles.metricValue}>{formatDelay(responseDelayMs)}</Text>
                </Text>
              </View>
            ) : null}

            <View style={styles.headerRight}>
              <Link href="/" style={styles.backLink}>
                <Ionicons name="arrow-back" size={15} color={colors.textMuted} /> Kembali ke beranda
              </Link>
              <View style={styles.userChip}>
                <View style={styles.userInitial}>
                  <Text style={styles.userInitialText}>{initialOf(profile.addressAs)}</Text>
                </View>
                <View>
                  <Text style={styles.userName}>{profile.addressAs}</Text>
                  <Text style={styles.userSub}>Level: {levelLabel}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.main}>
          <View style={[styles.stage, styles.stageWide]}>
            <ScrollView
              style={styles.stageScroll}
              contentContainerStyle={[styles.stageContent, short && styles.stageContentShort]}
            >
              <View style={styles.stageTop}>
                <View style={styles.statusPill}>
                  <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
                  <Text style={[styles.statusPillText, { color: badge.color }]}>{badge.label.toUpperCase()}</Text>
                </View>
                <View style={styles.timerBox}>
                  <View style={styles.timerRow}>
                    <Text style={styles.timer}>{formatClock(elapsedSec)}</Text>
                    <Text style={styles.timerLabel}>DURASI</Text>
                  </View>
                  {saveNote}
                </View>
              </View>

              <View style={[styles.persona, short && styles.personaShort]}>
                <TutorAvatar
                  size={avatarSize}
                  initial={TUTOR_INITIAL}
                  photo={TUTOR_PHOTO}
                  variant="glow"
                  pulsing={tutorSpeaking}
                  badge={micBadge}
                />
                <View style={styles.nameRow}>
                  <Text style={styles.tutorName}>{TUTOR_NAME}</Text>
                  <Text style={styles.tutorTag}>Guru AI</Text>
                </View>
                <Text style={styles.lessonLine}>
                  Pelajaran: <Text style={styles.lessonTitle}>{lessonsDone === null ? '…' : shownLesson.title}</Text>
                </Text>
                <View style={styles.barsBox}>
                  <VoiceBars source={barsSource} level={micLevel} maxHeight={26} />
                </View>
                <Text style={styles.activity}>● {activityText(status, tutorSpeaking, muted)}</Text>
                {notices}
              </View>
            </ScrollView>

            {/* Pinned below the scrollable part so the call button is never cut off on short screens. */}
            <View style={[styles.controls, short && styles.controlsShort]}>
              <View style={styles.controlsRow}>
                {muteButton}
                {mainButton}
              </View>
            </View>
          </View>

          <View style={styles.transcriptWide}>{transcriptPanel}</View>
        </View>
      </View>
    );
  }

  // ---- Phone ---------------------------------------------------------------------------------

  return (
    <View style={styles.root}>
      <View style={styles.phoneBody}>
        <View style={styles.phoneNav}>
          <Link href="/" asChild>
            <Pressable style={styles.navPill} accessibilityRole="link">
              <Ionicons name="chevron-back" size={14} color={colors.textSoft} />
              <Text style={styles.navPillText}>Kembali ke beranda</Text>
            </Pressable>
          </Link>
          <View style={styles.modePill}>
            <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.modePillText}>Mode: {MODE_LABELS[mode]}</Text>
          </View>
        </View>

        <View style={styles.phoneMeta}>
          <Text style={[styles.phoneStatus, { color: status === 'active' ? colors.emerald : colors.textMuted }]}>
            {badge.label.toUpperCase()}
          </Text>
          <Text style={styles.phoneTimer}>{formatClock(elapsedSec)}</Text>
          {saveNote}
          {responseDelayMs !== null ? (
            <Text style={styles.phoneMetric}>Jeda jawaban: {formatDelay(responseDelayMs)}</Text>
          ) : null}
          {notices}
        </View>

        <View style={styles.phoneStage}>
          <TutorAvatar size={104} initial={TUTOR_INITIAL} photo={TUTOR_PHOTO} variant="halo" pulsing={tutorSpeaking} badge={micBadge} />
          <Text style={styles.phoneName}>{TUTOR_NAME}</Text>
          <Text style={styles.phoneLesson} numberOfLines={1}>
            Pelajaran: {lessonsDone === null ? '…' : shownLesson.title}
          </Text>
          <View style={styles.phoneActivity}>
            <VoiceBars source={barsSource} level={micLevel} count={5} maxHeight={16} barWidth={4} />
            <Text style={styles.phoneActivityText}>{activityText(status, tutorSpeaking, muted)}</Text>
          </View>
        </View>

        <View style={styles.phoneTranscript}>{transcriptPanel}</View>
      </View>

      <View style={styles.dock}>
        {muteButton}
        {mainButton}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },

  // Desktop header
  header: {
    height: 80,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 43, 77, 0.7)',
    backgroundColor: colors.headerBg,
    justifyContent: 'center',
  },
  headerInner: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: space.xxxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  brandTile: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: 'rgba(6, 214, 160, 0.5)',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  brandName: { color: colors.text, fontFamily: fonts.bold, fontSize: fontSize.xl },
  brandTag: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: fontSize.xs,
    letterSpacing: 1,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(6, 214, 160, 0.1)',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  brandMode: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: fontSize.sm },
  brandModeValue: { color: colors.glow, fontFamily: fonts.semibold },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15, 23, 46, 0.8)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  metricValue: { color: colors.textSoft, fontFamily: fonts.mono, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backLink: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: fontSize.sm, paddingHorizontal: space.md },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: space.md,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(30, 43, 77, 0.7)',
  },
  userInitial: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4F46E5',
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitialText: { color: colors.textStrong, fontFamily: fonts.bold, fontSize: fontSize.md },
  userName: { color: colors.text, fontFamily: fonts.semibold, fontSize: fontSize.sm },
  userSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: fontSize.xxs },

  // Desktop main
  main: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: space.xxl,
    paddingHorizontal: space.xxxl,
    paddingVertical: space.xxl,
  },
  stage: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xxl,
    boxShadow: shadows.card,
    overflow: 'hidden',
  },
  stageWide: { flex: 5 },
  stageScroll: { flex: 1 },
  stageContent: { flexGrow: 1, padding: space.xxxl, paddingBottom: space.lg, justifyContent: 'space-between' },
  stageContentShort: { paddingHorizontal: space.xxl, paddingTop: space.xl, paddingBottom: space.sm },
  personaShort: { paddingVertical: space.sm },
  controlsShort: { paddingTop: space.md, paddingBottom: space.lg },
  transcriptWide: { flex: 7 },
  stageTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(30, 43, 77, 0.8)',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { fontFamily: fonts.semibold, fontSize: fontSize.xxs, letterSpacing: 0.6 },
  timerBox: { alignItems: 'flex-end', gap: 4 },
  timerRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  timer: {
    color: colors.textStrong,
    fontFamily: fonts.mono,
    fontWeight: '700',
    fontSize: fontSize.xxl,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  timerLabel: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: fontSize.xxs, letterSpacing: 1 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  saveNote: { color: colors.primary, fontFamily: fonts.medium, fontSize: fontSize.xs },
  saveFailed: { color: colors.dangerText, fontFamily: fonts.medium, fontSize: fontSize.xs },
  persona: { alignItems: 'center', paddingVertical: space.lg, gap: space.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  tutorName: { color: colors.textStrong, fontFamily: fonts.bold, fontSize: fontSize.xxl },
  tutorTag: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: fontSize.xxs,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(6, 214, 160, 0.2)',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  lessonLine: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: fontSize.sm },
  lessonTitle: { color: colors.textSoft },
  barsBox: {
    marginTop: space.xl,
    width: '100%',
    maxWidth: 320,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(30, 43, 77, 0.6)',
  },
  activity: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: fontSize.xs, marginTop: space.sm },
  warning: { color: colors.warning, fontFamily: fonts.medium, fontSize: fontSize.sm, marginTop: space.sm },
  errorBox: {
    backgroundColor: colors.errorBg,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 4,
    marginTop: space.sm,
    maxWidth: 420,
  },
  errorText: { color: colors.textStrong, fontFamily: fonts.medium, fontSize: fontSize.md },
  errorDetail: { color: colors.errorText, fontFamily: fonts.regular, fontSize: fontSize.sm },
  inlineLink: { color: colors.cyan, fontFamily: fonts.semibold, fontSize: fontSize.md, marginTop: 4 },
  controls: {
    marginHorizontal: space.xxxl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 43, 77, 0.8)',
    paddingTop: space.xl,
    paddingBottom: space.xxl,
  },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.md },
  squareButton: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedButton: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerBorder },
  mainButtonWide: {
    flex: 1,
    maxWidth: 220,
    height: 52,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
  },
  callStartWide: {
    backgroundColor: colors.callStart,
    borderColor: colors.callStartBorder,
    boxShadow: '0 10px 20px -8px rgba(6, 78, 59, 0.6)',
  },
  hangUp: { backgroundColor: colors.dangerSolid, borderColor: colors.dangerBorder },
  hangUpIcon: { transform: [{ rotate: '135deg' }] },
  mainButtonText: { color: colors.textStrong, fontFamily: fonts.bold, fontSize: fontSize.lg },
  mainButtonTextDark: { color: colors.onPrimary },
  mainButtonTextPhone: { fontSize: fontSize.lg },
  micBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBadgeSmall: { width: 30, height: 30, borderRadius: 15 },
  micBadgeMuted: { backgroundColor: colors.dangerSolid },

  // Phone
  phoneBody: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.md },
  phoneNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.6)',
  },
  navPillText: { color: colors.textSoft, fontFamily: fonts.medium, fontSize: fontSize.sm },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(6, 214, 160, 0.1)',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  modePillText: { color: colors.emerald, fontFamily: fonts.semibold, fontSize: fontSize.xs },
  phoneMeta: { alignItems: 'center', gap: 2 },
  phoneStatus: { fontFamily: fonts.medium, fontSize: fontSize.xs, letterSpacing: 1 },
  phoneTimer: {
    color: colors.textStrong,
    fontFamily: fonts.extrabold,
    fontSize: fontSize.display,
    fontVariant: ['tabular-nums'],
  },
  phoneMetric: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: fontSize.xs },
  phoneStage: { alignItems: 'center', gap: 2 },
  phoneName: { color: colors.textStrong, fontFamily: fonts.bold, fontSize: fontSize.lg, marginTop: 2 },
  phoneLesson: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: fontSize.sm, maxWidth: '90%' },
  phoneActivity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: 6,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.8)',
  },
  phoneActivityText: { color: colors.textSoft, fontFamily: fonts.medium, fontSize: fontSize.xs },
  phoneTranscript: { flex: 1, minHeight: 160, marginBottom: space.md },
  dock: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.xxl,
    paddingHorizontal: space.xxl,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.8)',
  },
  roundButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButtonPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: space.xxl,
    minWidth: 170,
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  callStartPhone: { backgroundColor: colors.primary, boxShadow: shadows.callButton },
});
