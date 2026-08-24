import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLORS } from '../theme/colors';
import { Cpu, ShieldCheck, Sparkles } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ScanningHUD = ({ statusText = 'Analyzing Hydrological Contours...' }) => {
  const scanLineY = useSharedValue(0);
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    scanLineY.value = withRepeat(
      withTiming(200, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    glowOpacity.value = withRepeat(
      withTiming(0.9, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  const textGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.overlay}>
      <View style={styles.scannerBox}>
        {/* Animated Scan Line */}
        <Animated.View style={[styles.scanLine, scanLineStyle]} />

        {/* HUD Corner Targets */}
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />

        <View style={styles.centerContent}>
          <Cpu size={42} color={COLORS.cyberBlue} style={styles.cpuIcon} />
          <Text style={styles.hudTitle}>HYDRO DEPTH ENGINE</Text>
          <Animated.Text style={[styles.hudStatus, textGlowStyle]}>
            {statusText}
          </Animated.Text>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.tag}>
            <Sparkles size={12} color={COLORS.skyBlue} />
            <Text style={styles.tagText}>CNN Depth Detection</Text>
          </View>
          <View style={styles.tag}>
            <ShieldCheck size={12} color={COLORS.safeGreen} />
            <Text style={styles.tagText}>Geospatial Verification</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 17, 32, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    padding: 20,
  },
  scannerBox: {
    width: SCREEN_WIDTH - 60,
    height: 260,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 20,
    borderColor: COLORS.cyberBlue,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 20,
    alignItems: 'center',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.skyBlue,
    shadowColor: COLORS.cyberBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 5,
  },
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: COLORS.skyBlue,
  },
  topLeft: {
    top: 10,
    left: 10,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 10,
    right: 10,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  centerContent: {
    alignItems: 'center',
    marginTop: 20,
  },
  cpuIcon: {
    marginBottom: 10,
  },
  hudTitle: {
    color: COLORS.skyBlue,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  hudStatus: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  tagText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
});
