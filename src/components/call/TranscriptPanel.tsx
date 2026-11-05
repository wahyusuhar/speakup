// Conversation transcript card for the call screen (desktop and phone variants).
import { Ionicons } from '@expo/vector-icons';
import { memo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import { highlightEnglish } from '@/content/highlightEnglish';
import type { TranscriptTurn } from '@/live/useLiveCall';
import { colors, fonts, fontSize, radius, shadows, space } from '@/theme/tokens';

import { formatClock } from './format';

type Props = {
  turns: readonly TranscriptTurn[];
  /** Turns still being spoken, shown dimmed after the finished ones. */
  liveTurns: readonly TranscriptTurn[];
  /** English items of the lesson in use; matches in tutor bubbles are colored. */
  englishItems: readonly string[];
  tutorName: string;
  compact?: boolean;
};

const Bubble = memo(function Bubble({
  turn,
  live,
  englishItems,
  tutorName,
  compact,
}: {
  turn: TranscriptTurn;
  live: boolean;
  englishItems: readonly string[];
  tutorName: string;
  compact: boolean;
}) {
  const isUser = turn.speaker === 'user';
  const meta = [
    isUser ? 'Kamu' : tutorName,
    compact ? null : formatClock(turn.atSec),
    turn.interrupted ? 'terpotong' : null,
    live ? '…' : null,
  ].filter((p): p is string => p !== null);
  const textStyle = [styles.text, compact && styles.textCompact, isUser && styles.textUser];

  return (
    <View style={[styles.item, isUser ? styles.itemUser : styles.itemTutor, live && styles.live]}>
      <Text style={[styles.meta, compact && styles.metaCompact]}>
        <Text style={isUser ? styles.nameUser : compact ? styles.nameTutorCompact : styles.nameTutor}>
          {meta[0]}
        </Text>
        {meta.length > 1 ? <Text style={styles.metaRest}>{'  •  ' + meta.slice(1).join('  •  ')}</Text> : null}
      </Text>
      <View
        style={[
          styles.bubble,
          compact && styles.bubbleCompact,
          isUser ? styles.bubbleUser : styles.bubbleTutor,
        ]}
      >
        {isUser ? (
          <Text style={textStyle}>{turn.text}</Text>
        ) : (
          <Text style={textStyle}>
            {highlightEnglish(turn.text, englishItems).map((seg, i) =>
              seg.english ? (
                <Text key={i} style={styles.english}>
                  {seg.text}
                </Text>
              ) : (
                seg.text
              ),
            )}
          </Text>
        )}
      </View>
    </View>
  );
});

export function TranscriptPanel({ turns, liveTurns, englishItems, tutorName, compact = false }: Props) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const empty = turns.length === 0 && liveTurns.length === 0;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        {compact ? (
          <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
        ) : (
          <View style={styles.headerIcon}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={[styles.title, compact && styles.titleCompact]}>Teks percakapan</Text>
          {compact ? null : <Text style={styles.subtitle}>Transkripsi langsung selama telepon</Text>}
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, compact && styles.contentCompact]}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {empty ? <Text style={styles.placeholder}>Teks percakapan akan muncul di sini selama telepon.</Text> : null}
        {turns.map((turn, i) => (
          <Bubble
            key={i}
            turn={turn}
            live={false}
            englishItems={englishItems}
            tutorName={tutorName}
            compact={compact}
          />
        ))}
        {liveTurns.map((turn) => (
          <Bubble
            key={`live-${turn.speaker}`}
            turn={turn}
            live
            englishItems={englishItems}
            tutorName={tutorName}
            compact={compact}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    boxShadow: shadows.card,
  },
  cardCompact: { borderRadius: radius.xl, borderColor: colors.borderSubtle },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: 28,
    paddingVertical: space.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardHeader,
  },
  headerCompact: {
    gap: space.sm,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    marginHorizontal: 0,
    backgroundColor: 'transparent',
    borderBottomColor: '#1E293B',
  },
  headerIcon: {
    padding: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(6, 214, 160, 0.2)',
  },
  headerText: { flex: 1 },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: fontSize.base },
  titleCompact: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.textSoft },
  subtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: fontSize.sm, marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: space.xxl, gap: space.xl },
  contentCompact: { padding: 14, gap: 10 },
  placeholder: { color: colors.textDim, fontFamily: fonts.regular, fontSize: fontSize.md },
  item: { maxWidth: 600, gap: 6 },
  itemTutor: { alignSelf: 'flex-start', alignItems: 'flex-start', maxWidth: '88%' },
  itemUser: { alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '80%' },
  live: { opacity: 0.7 },
  meta: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, paddingHorizontal: 4 },
  metaCompact: { fontSize: fontSize.xxs },
  metaRest: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.textMuted },
  nameTutor: { fontFamily: fonts.semibold, color: colors.primary },
  nameTutorCompact: { fontFamily: fonts.semibold, color: colors.textMuted },
  nameUser: { fontFamily: fonts.semibold, color: colors.userName },
  bubble: { borderRadius: radius.xl, paddingHorizontal: space.xl, paddingVertical: space.lg },
  bubbleCompact: { paddingHorizontal: 14, paddingVertical: space.sm },
  bubbleTutor: {
    backgroundColor: colors.bubbleTutor,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderTopLeftRadius: radius.sm,
  },
  bubbleUser: { backgroundColor: colors.bubbleUser, borderTopRightRadius: radius.sm, boxShadow: shadows.userBubble },
  text: { color: colors.text, fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 26 },
  textCompact: { fontSize: fontSize.md, lineHeight: 21 },
  textUser: { color: colors.textStrong, fontFamily: fonts.medium },
  english: { color: colors.english, fontFamily: fonts.semibold },
});
