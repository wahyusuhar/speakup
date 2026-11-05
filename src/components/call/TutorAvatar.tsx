// Tutor avatar with the glowing ring from the call-screen design.
// Shows `photo` (an image from assets/) cropped into the circle around its focus point;
// falls back to the initial when there is no photo or it fails to load.
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import type { AvatarPhoto } from '@/config/tutor';
import { colors, fonts, shadows } from '@/theme/tokens';

import { avatarCrop } from './avatarCrop';

type Props = {
  size: number;
  initial: string;
  photo?: AvatarPhoto;
  /** 'glow': soft glow around the photo (desktop). 'halo': extra concentric ring (phone). */
  variant?: 'glow' | 'halo';
  /** Pulses the glow; pass true only while the tutor is actually speaking. */
  pulsing?: boolean;
  /** Small round badge at the bottom right (e.g. mic state). */
  badge?: ReactNode;
};

export function TutorAvatar({ size, initial, photo, variant = 'glow', pulsing = false, badge }: Props) {
  const [pulse] = useState(() => new Animated.Value(0));
  const [photoFailed, setPhotoFailed] = useState(false);
  const crop = photo && !photoFailed ? avatarCrop(size, photo, photo.focus, photo.zoom) : null;

  useEffect(() => {
    if (!pulsing) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulsing, pulse]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const ring = 4;
  const outer = variant === 'halo' ? Math.round(size * 1.57) : size + 24;

  return (
    <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
      {variant === 'halo' ? (
        <>
          <Animated.View
            style={[
              styles.abs,
              {
                width: outer,
                height: outer,
                borderRadius: outer / 2,
                borderWidth: 1,
                borderColor: 'rgba(6, 214, 160, 0.25)',
                transform: [{ scale: haloScale }],
              },
            ]}
          />
          <View
            style={[
              styles.abs,
              {
                width: size * 1.28,
                height: size * 1.28,
                borderRadius: size,
                backgroundColor: 'rgba(6, 214, 160, 0.08)',
              },
            ]}
          />
        </>
      ) : null}
      <Animated.View
        style={[
          styles.abs,
          {
            width: size + ring * 2,
            height: size + ring * 2,
            borderRadius: size,
            boxShadow: variant === 'glow' ? shadows.glowStrong : shadows.glow,
            opacity: glowOpacity,
          },
        ]}
      />
      <View
        style={{
          width: size + ring * 2,
          height: size + ring * 2,
          borderRadius: size,
          padding: ring,
          backgroundColor: variant === 'glow' ? colors.bg : colors.primary,
          borderWidth: variant === 'glow' ? 2 : 0,
          borderColor: colors.primary,
        }}
      >
        <View style={[styles.inner, { borderRadius: size / 2 }, crop && styles.innerPhoto]}>
          {photo && crop ? (
            <Image
              source={photo.source}
              style={{ position: 'absolute', ...crop }}
              resizeMode="stretch"
              onError={() => setPhotoFailed(true)}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Text style={[styles.initial, { fontSize: Math.round(size * 0.42) }]}>{initial}</Text>
          )}
        </View>
      </View>
      {badge ? (
        <View style={[styles.abs, { right: (outer - size) / 2 - 2, bottom: (outer - size) / 2 - 2 }]}>{badge}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  inner: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#11203F',
  },
  innerPhoto: { backgroundColor: '#FFFFFF' },
  initial: { color: colors.textStrong, fontFamily: fonts.extrabold },
});
