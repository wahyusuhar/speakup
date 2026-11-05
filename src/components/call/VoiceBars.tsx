// Voice activity bars. Driven by real state only: the student's measured mic level,
// or a gentle animation while the tutor's audio is actually playing. Flat when idle.
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

type Props = {
  /** 'tutor' while tutor audio plays, 'student' to show `level`, 'idle' otherwise. */
  source: 'tutor' | 'student' | 'idle';
  /** Student mic level 0..1. */
  level: number;
  count?: number;
  maxHeight?: number;
  barWidth?: number;
};

const SHAPE = [0.45, 0.7, 1, 0.8, 0.95, 0.75, 1, 0.6, 0.4];
const BAR_COLORS = [colors.primary, colors.cyan, colors.primary, colors.emerald, colors.cyan];
const MIN = 4;

export function VoiceBars({ source, level, count = 9, maxHeight = 28, barWidth = 5 }: Props) {
  const [anims] = useState(() => Array.from({ length: count }, () => new Animated.Value(0)));

  useEffect(() => {
    if (source !== 'tutor') {
      anims.forEach((a) => {
        a.stopAnimation();
        a.setValue(0);
      });
      return;
    }
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((i % 5) * 90),
          Animated.timing(a, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(a, { toValue: 0.2, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [source, anims]);

  return (
    <View style={[styles.row, { height: maxHeight }]}>
      {anims.map((a, i) => {
        const shape = SHAPE[i % SHAPE.length] ?? 1;
        const range = (maxHeight - MIN) * shape;
        const height =
          source === 'tutor'
            ? a.interpolate({ inputRange: [0, 1], outputRange: [MIN, MIN + range] })
            : source === 'student'
              ? MIN + range * Math.min(1, level)
              : MIN;
        return (
          <Animated.View
            key={i}
            style={{
              width: barWidth,
              height,
              borderRadius: barWidth,
              backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
              opacity: source === 'idle' ? 0.35 : 0.9,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
});
