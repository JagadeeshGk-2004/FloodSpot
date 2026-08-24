import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { COLORS } from '../theme/colors';

export const RadarPulse = ({
  color = COLORS.danger,
  size = 40,
  maxScale = 2.5,
  duration = 2000,
  children,
}) => {
  const scale1 = useSharedValue(1);
  const opacity1 = useSharedValue(0.8);

  const scale2 = useSharedValue(1);
  const opacity2 = useSharedValue(0.8);

  useEffect(() => {
    // Ring 1 Animation
    scale1.value = withRepeat(
      withTiming(maxScale, { duration, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    opacity1.value = withRepeat(
      withTiming(0, { duration, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );

    // Ring 2 Staggered Animation
    scale2.value = withDelay(
      duration / 2,
      withRepeat(
        withTiming(maxScale, { duration, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
    opacity2.value = withDelay(
      duration / 2,
      withRepeat(
        withTiming(0, { duration, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
  }, [maxScale, duration]);

  const animatedStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: scale1.value }],
    opacity: opacity1.value,
  }));

  const animatedStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: scale2.value }],
    opacity: opacity2.value,
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          animatedStyle1,
        ]}
      />
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          animatedStyle2,
        ]}
      />
      <View style={[styles.centerPin, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
  },
  centerPin: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
