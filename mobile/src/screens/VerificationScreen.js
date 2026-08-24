import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../theme/colors';
import { GlassView } from '../components/GlassView';
import { apiClient, API_BASE_URL, ENDPOINTS } from '../config/api';
import {
  Sparkles,
  CheckCircle2,
  MapPin,
  Clock,
  ThumbsUp,
  ThumbsDown,
  PhoneCall,
  CameraOff,
} from 'lucide-react-native';

const HELPLINES = [
  { name: 'Flood Control Helpline', number: '1913' },
  { name: 'Disaster Response', number: '1070' },
  { name: 'Emergency Fire & Rescue', number: '101' },
];

function formatString(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return val.name || val.location_name || val.title || (val.latitude && val.longitude ? `${val.latitude}, ${val.longitude}` : fallback);
  }
  return String(val);
}

function resolveImageUrl(item) {
  if (!item) return null;
  const raw = item.image_url || item.image || item.photo_url || item.image_base64;
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://') || cleaned.startsWith('data:image')) {
    return cleaned;
  }
  if (cleaned.length > 50 && !cleaned.includes('/')) {
    return `data:image/jpeg;base64,${cleaned}`;
  }
  if (cleaned.startsWith('/')) {
    return `${API_BASE_URL}${cleaned}`;
  }
  return `${API_BASE_URL}/${cleaned}`;
}

export default function VerificationScreen() {
  const [reports, setReports] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [verifications, setVerifications] = useState({});
  const [failedImages, setFailedImages] = useState({});

  const fetchReports = useCallback(async () => {
    setRefreshing(true);
    try {
      const resp = await apiClient.get(ENDPOINTS.REPORTS);
      if (resp.data) {
        // Exclude reports flagged 3+ times by community consensus
        const activeReports = resp.data.filter((r) => {
          const downvotes = r.downvotes || r.fake_flags || 0;
          return downvotes < 3 && r.status !== 'FLAGGED_REMOVED';
        });
        setReports(activeReports);
      }
    } catch (err) {
      console.log('[VerificationScreen] Error fetching reports:', err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [fetchReports])
  );

  const handleUpvote = async (reportId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVerifications((prev) => {
      const current = prev[reportId] || { upvotes: 0, flags: 0, voted: null };
      if (current.voted === 'upvote') return prev;
      const newUpvotes = current.upvotes + 1;
      const newFlags = current.voted === 'flag' ? Math.max(0, current.flags - 1) : current.flags;
      return {
        ...prev,
        [reportId]: { upvotes: newUpvotes, flags: newFlags, voted: 'upvote' },
      };
    });

    try {
      await apiClient.post(ENDPOINTS.REPORT_VOTE(reportId), { vote_type: 'up' });
    } catch (err) {
      console.log('Vote API note:', err.message);
    }
  };

  const handleFlag = async (reportId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    let reachedTakedownThreshold = false;
    setVerifications((prev) => {
      const current = prev[reportId] || { upvotes: 0, flags: 0, voted: null };
      if (current.voted === 'flag') return prev;
      const newFlags = current.flags + 1;
      const newUpvotes = current.voted === 'upvote' ? Math.max(0, current.upvotes - 1) : current.upvotes;
      
      if (newFlags >= 3) {
        reachedTakedownThreshold = true;
      }

      return {
        ...prev,
        [reportId]: { upvotes: newUpvotes, flags: newFlags, voted: 'flag' },
      };
    });

    // Instant community takedown upon 3 flags
    if (reachedTakedownThreshold) {
      setReports((prev) => prev.filter((r) => String(r.id) !== String(reportId)));
      Alert.alert(
        'Community Takedown Active',
        'Report marked as false positive by community consensus and removed.'
      );
    }

    try {
      await apiClient.post(ENDPOINTS.REPORT_VOTE(reportId), { vote_type: 'down' });
    } catch (err) {
      console.log('Vote API note:', err.message);
    }
  };

  const renderReportCard = ({ item }) => {
    const vData = verifications[item.id] || {
      upvotes: item.upvotes || 0,
      flags: item.downvotes || 0,
      voted: null,
    };

    const isCritical = item.isCritical ?? (item.severity?.toUpperCase() === 'CRITICAL' || item.level?.toUpperCase() === 'CRITICAL' || item.level === 'EMERGENCY_SOS');
    const isHigh = item.isHigh ?? (item.severity?.toUpperCase() === 'HIGH' || item.level?.toUpperCase() === 'HIGH');
    const isImageFailed = failedImages[item.id];
    const imageUrl = isImageFailed ? null : resolveImageUrl(item);

    return (
      <GlassView style={styles.card}>
        {/* Card Header Row: Location Title & Severity Badge */}
        <View style={styles.cardHeader}>
          <View style={styles.locationContainer}>
            <MapPin size={16} color={COLORS.skyBlue} />
            <Text style={styles.locationTitle} numberOfLines={1}>
              {formatString(item.location_name || item.location, 'Reported Area')}
            </Text>
          </View>

          <View
            style={[
              styles.severityBadge,
              isCritical
                ? { backgroundColor: 'rgba(239,68,68,0.2)', borderColor: COLORS.danger }
                : isHigh
                ? { backgroundColor: 'rgba(249,115,22,0.2)', borderColor: COLORS.highOrange }
                : { backgroundColor: 'rgba(245,158,11,0.2)', borderColor: COLORS.mediumYellow },
            ]}
          >
            <Text
              style={[
                styles.severityText,
                isCritical
                  ? { color: COLORS.danger }
                  : isHigh
                  ? { color: COLORS.highOrange }
                  : { color: COLORS.mediumYellow },
              ]}
            >
              {formatString(item.severity, 'MEDIUM').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Sub-Header: Timestamp & Hydro Depth Engine Verification Badge */}
        <View style={styles.metaRow}>
          <View style={styles.timeRow}>
            <Clock size={12} color={COLORS.textMuted} />
            <Text style={styles.timeText}>
              {item.created_at
                ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Recently'}
            </Text>
          </View>

          <View style={styles.verifiedBadge}>
            <CheckCircle2 size={12} color={COLORS.safeGreen} />
            <Text style={styles.verifiedBadgeText}>Hydro Depth Engine Verified</Text>
          </View>
        </View>

        {/* Incident Description */}
        <Text style={styles.descriptionText}>
          {formatString(item.description, 'Community waterlogging report.')}
        </Text>

        {/* Exact User Uploaded Photo / Neutral Container if No Photo Attached */}
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
            onError={() => {
              console.log('[VerificationScreen] Image load error for ID:', item.id);
              setFailedImages((prev) => ({ ...prev, [item.id]: true }));
            }}
          />
        ) : (
          <View style={styles.noImageCard}>
            <CameraOff size={18} color={COLORS.textMuted} />
            <Text style={styles.noImageText}>No Citizen Photo Attached</Text>
          </View>
        )}

        {/* Interactive Voting Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.voteMetaText}>
            👍 {vData.upvotes} Confirm • 🚩 {vData.flags} Flagged
          </Text>

          <View style={styles.voteBtnRow}>
            <TouchableOpacity
              style={[styles.voteBtn, vData.voted === 'upvote' && styles.voteBtnConfirmActive]}
              onPress={() => handleUpvote(item.id)}
            >
              <ThumbsUp size={12} color={vData.voted === 'upvote' ? '#FFF' : COLORS.safeGreen} />
              <Text
                style={[
                  styles.voteBtnText,
                  { color: vData.voted === 'upvote' ? '#FFF' : COLORS.safeGreen },
                ]}
              >
                {vData.voted === 'upvote' ? 'Confirmed' : 'Confirm'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.voteBtn, vData.voted === 'flag' && styles.voteBtnFlagActive]}
              onPress={() => handleFlag(item.id)}
            >
              <ThumbsDown size={12} color={vData.voted === 'flag' ? '#FFF' : COLORS.danger} />
              <Text
                style={[
                  styles.voteBtnText,
                  { color: vData.voted === 'flag' ? '#FFF' : COLORS.danger },
                ]}
              >
                {vData.voted === 'flag' ? 'Flagged' : 'Flag Fake'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </GlassView>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={reports}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderReportCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchReports}
            tintColor={COLORS.skyBlue}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <View style={styles.headerTitleRow}>
              <Sparkles size={22} color={COLORS.skyBlue} />
              <Text style={styles.headerTitle}>Community Verification</Text>
            </View>
            <Text style={styles.headerSub}>
              Help verify crowdsourced waterlogged area reports uploaded by citizens using Hydro Depth Engine + Community Review.
            </Text>

            <GlassView style={styles.bannerCard}>
              <CheckCircle2 size={18} color={COLORS.skyBlue} />
              <Text style={styles.bannerText}>
                Visual Feature Analysis Active — Hydro Depth Match Scoring Enabled
              </Text>
            </GlassView>

            <Text style={styles.sectionHeading}>
              Recent Community Reports ({reports.length})
            </Text>
          </View>
        }
        ListFooterComponent={
          <GlassView style={styles.helplineCard}>
            <View style={styles.helplineHeader}>
              <PhoneCall size={16} color={COLORS.mediumYellow} />
              <Text style={styles.helplineTitle}>Emergency Helplines</Text>
            </View>
            {HELPLINES.map((h, i) => (
              <Text key={i} style={styles.helplineLine}>
                • {h.name}: <Text style={{ fontWeight: '800', color: COLORS.skyBlue }}>{h.number}</Text>
              </Text>
            ))}
          </GlassView>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  listContent: {
    padding: 16,
    paddingTop: 50,
    paddingBottom: 130,
    gap: 12,
  },
  headerContainer: {
    marginBottom: 8,
    gap: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  headerSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderColor: 'rgba(56,189,248,0.3)',
    borderWidth: 1,
    marginTop: 4,
  },
  bannerText: {
    color: COLORS.skyBlue,
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  sectionHeading: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 10,
  },
  card: {
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  locationTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  verifiedBadgeText: {
    color: COLORS.safeGreen,
    fontSize: 10,
    fontWeight: '700',
  },
  descriptionText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  cardImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginVertical: 10,
  },
  noImageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    paddingVertical: 14,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  noImageText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 2,
  },
  voteMetaText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  voteBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
  },
  voteBtnConfirmActive: {
    backgroundColor: COLORS.safeGreen,
    borderColor: COLORS.safeGreen,
  },
  voteBtnFlagActive: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  voteBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  helplineCard: {
    padding: 14,
    gap: 6,
    marginTop: 10,
  },
  helplineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  helplineTitle: {
    color: COLORS.mediumYellow,
    fontSize: 13,
    fontWeight: '800',
  },
  helplineLine: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
