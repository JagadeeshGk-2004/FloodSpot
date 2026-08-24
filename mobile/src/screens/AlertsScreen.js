import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../theme/colors';
import { GlassView } from '../components/GlassView';
import { apiClient, ENDPOINTS } from '../config/api';
import {
  Bell,
  MapPin,
  ShieldCheck,
  Search,
  ThumbsUp,
  ThumbsDown,
  CloudRain,
  AlertTriangle,
  Clock,
  Navigation,
} from 'lucide-react-native';

// Haversine distance formula in meters/km
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function formatDistance(distKm) {
  if (distKm === null || distKm === undefined) return 'Distance unknown';
  if (distKm < 1) {
    return `${Math.round(distKm * 1000)}m away`;
  }
  return `${distKm.toFixed(1)} km away`;
}

function formatTimeAgo(isoString) {
  if (!isoString) return 'Just now';
  try {
    const diffMs = new Date() - new Date(isoString);
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch (e) {
    return 'Recently';
  }
}

function formatString(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return val.name || val.location_name || val.title || (val.latitude && val.longitude ? `${val.latitude}, ${val.longitude}` : fallback);
  }
  return String(val);
}

export default function AlertsScreen() {
  const [incidents, setIncidents] = useState([]);
  const [filteredIncidents, setFilteredIncidents] = useState([]);
  const [liveAdvisories, setLiveAdvisories] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('all');

  const fetchInitialData = useCallback(async () => {
    setRefreshing(true);
    try {
      // 1. Get user GPS coordinates
      const { status } = await Location.requestForegroundPermissionsAsync();
      let locCoords = { latitude: 13.0827, longitude: 80.2707 };
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        locCoords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(locCoords);
      }

      // 2. Fetch live user incidents exclusively from backend
      const reportsResp = await apiClient.get(ENDPOINTS.REPORTS, { params: { real_only: true } });
      let data = reportsResp.data || [];

      // Filter out mock entries to present real user data only
      const realOnlyData = data.filter((item) =>
        typeof item.id === 'string' ? !item.id.startsWith('mock-') : true
      );

      setIncidents(realOnlyData);
      applyFilters(realOnlyData, searchQuery, selectedSeverity);

      // 3. Fetch live weather & advisories
      const alertsResp = await apiClient.get(ENDPOINTS.ALERTS_LIVE, {
        params: { lat: locCoords.latitude, lon: locCoords.longitude },
      });
      if (alertsResp.data && alertsResp.data.emergency_helplines) {
        setLiveAdvisories(alertsResp.data.emergency_helplines);
      }
    } catch (err) {
      console.log('[AlertsScreen] Error fetching feeds:', err.message);
    } finally {
      setRefreshing(false);
    }
  }, [searchQuery, selectedSeverity]);

  // Auto-refresh when user switches to Alerts tab
  useFocusEffect(
    useCallback(() => {
      fetchInitialData();
    }, [fetchInitialData])
  );

  const applyFilters = (dataList, query, sev) => {
    let list = dataList || incidents;
    if (query.trim()) {
      list = list.filter((item) =>
        (item.location_name || '').toLowerCase().includes(query.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(query.toLowerCase())
      );
    }
    if (sev !== 'all') {
      list = list.filter((item) => item.severity === sev);
    }
    setFilteredIncidents(list);
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    applyFilters(incidents, text, selectedSeverity);
  };

  const handleSeverityFilter = (sev) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSeverity(sev);
    applyFilters(incidents, searchQuery, sev);
  };

  const handleVote = async (reportId, voteType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const resp = await apiClient.post(ENDPOINTS.REPORT_VOTE(reportId), { vote_type: voteType });
      if (resp.data) {
        setIncidents((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, ...resp.data } : r))
        );
        setFilteredIncidents((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, ...resp.data } : r))
        );
      }
    } catch (err) {
      Alert.alert('Vote Error', 'Could not record vote.');
    }
  };

  const renderItem = ({ item }) => {
    const distKm = userLocation
      ? calculateDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          item.latitude,
          item.longitude
        )
      : null;

    const isCritical = item.severity === 'critical';
    const isHigh = item.severity === 'high';

    return (
      <GlassView style={styles.incidentCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.locationContainer}>
            <MapPin size={16} color={COLORS.skyBlue} />
            <Text style={styles.locationTitle}>{formatString(item.location_name || item.location, 'Reported Area')}</Text>
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
              {formatString(item.severity, 'HIGH').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Distance & Time Ago Sub-header */}
        <View style={styles.metaRow}>
          <View style={styles.metaBadge}>
            <Navigation size={12} color={COLORS.skyBlue} />
            <Text style={styles.metaText}>{formatDistance(distKm)}</Text>
          </View>
          <View style={styles.metaBadge}>
            <Clock size={12} color={COLORS.textMuted} />
            <Text style={styles.metaText}>{formatTimeAgo(item.created_at)}</Text>
          </View>

          {item.verified && (
            <View style={styles.verifiedBadge}>
              <ShieldCheck size={12} color={COLORS.safeGreen} />
              <Text style={styles.verifiedBadgeText}>Hydro Depth Engine Verified</Text>
            </View>
          )}
        </View>

        {/* Description */}
        <Text style={styles.description}>{formatString(item.description, 'Community waterlogging report.')}</Text>

        {/* Photo Image if present */}
        {item.image_url && (
          <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
        )}

        {/* Upvote & Downvote Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.verifiedByLabel}>Verified by Community</Text>

          <View style={styles.voteBtnGroup}>
            <TouchableOpacity
              style={styles.voteBtn}
              onPress={() => handleVote(item.id, 'up')}
            >
              <ThumbsUp size={14} color={COLORS.skyBlue} />
              <Text style={styles.voteText}>{item.upvotes || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.voteBtn}
              onPress={() => handleVote(item.id, 'down')}
            >
              <ThumbsDown size={14} color={COLORS.textMuted} />
              <Text style={styles.voteText}>{item.downvotes || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </GlassView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Bell size={22} color={COLORS.skyBlue} />
          <Text style={styles.headerTitle}>Real-time Incident Feed</Text>
        </View>
        <Text style={styles.headerSub}>
          Live crowd-sourced flood alerts filtered by distance & severity.
        </Text>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by area or description..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
        </View>

        {/* Severity Filter Chips */}
        <View style={styles.filterRow}>
          {['all', 'critical', 'high', 'medium'].map((sev) => {
            const selected = selectedSeverity === sev;
            return (
              <TouchableOpacity
                key={sev}
                style={[styles.filterChip, selected && styles.filterChipActive]}
                onPress={() => handleSeverityFilter(sev)}
              >
                <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                  {sev.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filteredIncidents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchInitialData}
            tintColor={COLORS.skyBlue}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <CloudRain size={44} color={COLORS.skyBlue} />
            <Text style={styles.emptyTitle}>No Active Flood Reports Nearby</Text>
            <Text style={styles.emptyText}>
              Pull down to refresh or submit a report to alert nearby users.
            </Text>
          </View>
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
  header: {
    padding: 16,
    paddingTop: 50,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGlass,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    marginBottom: 6,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  headerSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 17, 32, 0.8)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
  },
  filterChipActive: {
    backgroundColor: COLORS.skyBlue,
    borderColor: COLORS.skyBlue,
  },
  filterChipText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 130,
  },
  incidentCard: {
    padding: 14,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    color: COLORS.safeGreen,
    fontSize: 10,
    fontWeight: '600',
  },
  depthText: {
    color: COLORS.skyBlue,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  cardImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  verifiedByLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  voteBtnGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  voteText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
    gap: 8,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
