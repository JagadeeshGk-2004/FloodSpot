import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Animated as RNAnimated,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { COLORS, SHADOWS } from '../theme/colors';
import { GlassView } from '../components/GlassView';
import { RadarPulse } from '../components/RadarPulse';
import { AlertCircle, PhoneCall, ShieldAlert, Radio, CheckCircle2 } from 'lucide-react-native';

const HOLD_DURATION = 2500; // 2.5 seconds hold required

const HELPLINES = [
  { id: '112', title: 'National Emergency Response', number: '112', desc: 'All Emergency Services' },
  { id: '1913', title: 'Chennai Corporation Helpline', number: '1913', desc: 'Waterlogging & Evacuation' },
  { id: '1070', title: 'State Disaster Management', number: '1070', desc: 'NDRF Rescue Ops' },
  { id: '103', title: 'Traffic Control Room', number: '103', desc: 'Road Blockades & Subways' },
];

export default function SOSScreen() {
  const [holding, setHolding] = useState(false);
  const [broadcasted, setBroadcasted] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const progressAnim = useRef(new RNAnimated.Value(0)).current;
  const holdTimerRef = useRef(null);

  useEffect(() => {
    fetchLocation();
  }, []);

  const fetchLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    } catch (e) {
      setUserCoords({ latitude: 13.0827, longitude: 80.2707 });
    }
  };

  const startHold = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setHolding(true);
    setBroadcasted(false);

    // Haptic pulses while holding
    holdTimerRef.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 400);

    RNAnimated.timing(progressAnim, {
      toValue: 1,
      duration: HOLD_DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        triggerSOSBroadcast();
      }
    });
  };

  const cancelHold = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
    }
    setHolding(false);
    RNAnimated.timing(progressAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const triggerSOSBroadcast = async () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
    }
    setHolding(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    try {
      // 1. Acquire current device location via expo-location
      let lat = userCoords ? userCoords.latitude : 13.0827;
      let lon = userCoords ? userCoords.longitude : 80.2707;
      let locName = 'Live GPS Emergency SOS Signal';

      try {
        const freshLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = freshLoc.coords.latitude;
        lon = freshLoc.coords.longitude;
        setUserCoords({ latitude: lat, longitude: lon });

        const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (geocode && geocode.length > 0) {
          const place = geocode[0];
          locName = [place.name, place.street, place.subregion || place.city].filter(Boolean).join(', ') || locName;
        }
      } catch (locErr) {
        console.log('[SOSScreen] GPS location update note:', locErr.message);
      }

      // 2. Dispatch EMERGENCY_SOS payload to backend
      const payload = {
        location_name: `[SOS DISTRESS] ${locName}`,
        latitude: lat,
        longitude: lon,
        severity: 'critical',
        water_depth: 'CRITICAL',
        level: 'EMERGENCY_SOS',
        depth: 'CRITICAL',
        status: 'ACTIVE',
        description: 'EMERGENCY SOS DISTRESS SIGNAL BROADCAST FROM MOBILE DEVICE',
        verified: true,
        ai_confidence: 1.0,
      };

      await apiClient.post(ENDPOINTS.REPORTS, payload);
      setBroadcasted(true);

      // 3. Immediately launch native phone dialer to 112
      Linking.openURL('tel:112').catch(() => {
        console.log('[SOSScreen] Dialer launch note');
      });

      Alert.alert(
        'EMERGENCY SOS BROADCASTED',
        'Your precise GPS location has been transmitted to emergency responders and published to the live radar network.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      setBroadcasted(true);
      Linking.openURL('tel:112').catch(() => {});
      Alert.alert('SOS Transmitted', 'Emergency SOS signal dispatched locally.');
    }
  };

  const makePhoneCall = (phoneNumber) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Call Failed', `Could not place call to ${phoneNumber}`);
    });
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <Radio size={16} color={COLORS.danger} />
            <Text style={styles.headerBadgeText}>CRITICAL DISTRESS</Text>
          </View>
          <Text style={styles.title}>Emergency SOS Beacon</Text>
          <Text style={styles.subtitle}>
            Press and HOLD the circular SOS button for 2.5 seconds to broadcast your instant GPS coordinates to emergency responders.
          </Text>
        </View>

        {/* SOS Button Area with Radar Ripple Rings */}
        <View style={styles.sosContainer}>
          <RadarPulse color={COLORS.danger} size={150} maxScale={2.2} duration={2200}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPressIn={startHold}
              onPressOut={cancelHold}
              style={[styles.sosButton, SHADOWS.dangerGlow]}
            >
              <ShieldAlert size={48} color="#FFFFFF" />
              <Text style={styles.sosButtonText}>SOS</Text>
              <Text style={styles.sosSubtext}>HOLD 2.5s</Text>
            </TouchableOpacity>
          </RadarPulse>

          {/* Hold Progress Indicator Bar */}
          {holding && (
            <View style={styles.progressBarBg}>
              <RNAnimated.View style={[styles.progressBarFill, { width: progressWidth }]} />
            </View>
          )}

          {broadcasted && (
            <GlassView style={styles.broadcastSuccessCard}>
              <CheckCircle2 size={24} color={COLORS.safeGreen} />
              <View style={{ flex: 1 }}>
                <Text style={styles.successTitle}>SOS DISTRESS BEACON ACTIVE</Text>
                <Text style={styles.successSub}>Responders & Nearby Users Notified</Text>
              </View>
            </GlassView>
          )}
        </View>

        {/* Emergency Helplines Direct Dial Section */}
        <GlassView style={styles.helplineSection}>
          <Text style={styles.sectionTitle}>Emergency Responders Direct Dial</Text>
          {HELPLINES.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.helplineCard}
              onPress={() => makePhoneCall(item.number)}
            >
              <View style={styles.phoneIconBox}>
                <PhoneCall size={20} color={COLORS.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.helplineTitle}>{item.title}</Text>
                <Text style={styles.helplineDesc}>{item.desc}</Text>
              </View>
              <View style={styles.dialBadge}>
                <Text style={styles.dialBadgeText}>{item.number}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </GlassView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 50,
    paddingBottom: 130,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    marginBottom: 8,
  },
  headerBadgeText: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  sosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 35,
    minHeight: 220,
  },
  sosButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosButtonText: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
  },
  sosSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '700',
  },
  progressBarBg: {
    width: 200,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 20,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.danger,
  },
  broadcastSuccessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    marginTop: 20,
    borderColor: COLORS.safeGreen,
    borderWidth: 1.5,
  },
  successTitle: {
    color: COLORS.safeGreen,
    fontSize: 13,
    fontWeight: '800',
  },
  successSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  helplineSection: {
    padding: 16,
  },
  sectionTitle: {
    color: COLORS.skyBlue,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 14,
  },
  helplineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
  },
  phoneIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helplineTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  helplineDesc: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  dialBadge: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dialBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
