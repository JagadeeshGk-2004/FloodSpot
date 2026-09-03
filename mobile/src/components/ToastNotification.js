import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { GlassView } from './GlassView';
import { COLORS } from '../theme/colors';
import { ShieldCheck, Wifi, WifiOff, AlertTriangle, X } from 'lucide-react-native';

export function ToastNotification({ toast, onDismiss }) {
  if (!toast || !toast.text) return null;

  const isCritical = toast.type === 'critical';
  const isOffline = toast.type === 'offline';
  const isSuccess = toast.type === 'success';

  return (
    <View style={styles.container}>
      <GlassView
        style={[
          styles.card,
          isCritical && styles.cardCritical,
          isOffline && styles.cardOffline,
          isSuccess && styles.cardSuccess,
        ]}
      >
        <View style={styles.contentRow}>
          {isSuccess ? (
            <ShieldCheck size={16} color={COLORS.safeGreen} />
          ) : isOffline ? (
            <WifiOff size={16} color={COLORS.mediumYellow} />
          ) : isCritical ? (
            <AlertTriangle size={16} color={COLORS.danger} />
          ) : (
            <Wifi size={16} color={COLORS.skyBlue} />
          )}

          <Text style={styles.text}>{toast.text}</Text>

          {onDismiss && (
            <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
              <X size={14} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 55,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  card: {
    padding: 12,
    borderRadius: 16,
    borderColor: COLORS.border,
    borderWidth: 1,
    backgroundColor: COLORS.card,
  },
  cardCritical: {
    borderColor: 'rgba(239, 68, 68, 0.7)',
    backgroundColor: 'rgba(127, 29, 29, 0.95)',
  },
  cardOffline: {
    borderColor: 'rgba(245, 158, 11, 0.7)',
    backgroundColor: 'rgba(120, 53, 15, 0.95)',
  },
  cardSuccess: {
    borderColor: 'rgba(16, 185, 129, 0.7)',
    backgroundColor: 'rgba(6, 78, 59, 0.95)',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 2,
  },
});
