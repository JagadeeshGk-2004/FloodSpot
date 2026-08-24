import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS, SHADOWS } from '../theme/colors';

import MapScreen from '../screens/MapScreen';
import ReportScreen from '../screens/ReportScreen';
import SOSScreen from '../screens/SOSScreen';
import RoutesScreen from '../screens/RoutesScreen';
import VerificationScreen from '../screens/VerificationScreen';

import { Map, PlusCircle, ShieldAlert, Navigation, Sparkles } from 'lucide-react-native';

const Tab = createBottomTabNavigator();

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const dynamicBottom = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.tabBarWrapper, { bottom: dynamicBottom }]}>
      <View style={[styles.glassTabBar, SHADOWS.card]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          let IconComponent = Map;
          let label = 'Radar';
          let isSOS = false;

          if (route.name === 'MapTab') {
            IconComponent = Map;
            label = 'Radar';
          } else if (route.name === 'ReportTab') {
            IconComponent = PlusCircle;
            label = 'Report';
          } else if (route.name === 'SOSTab') {
            IconComponent = ShieldAlert;
            label = 'SOS';
            isSOS = true;
          } else if (route.name === 'RoutesTab') {
            IconComponent = Navigation;
            label = 'Routes';
          } else if (route.name === 'VerifyTab') {
            IconComponent = Sparkles;
            label = 'Verify';
          }

          if (isSOS) {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.85}
                style={styles.sosTabBtnContainer}
              >
                <View style={[styles.sosBadgeBtn, SHADOWS.dangerGlow]}>
                  <ShieldAlert size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.sosTabLabel}>{label}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tabBtn}
            >
              <IconComponent
                size={18}
                color={isFocused ? COLORS.skyBlue : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  isFocused && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="MapTab" component={MapScreen} />
      <Tab.Screen name="ReportTab" component={ReportScreen} />
      <Tab.Screen name="SOSTab" component={SOSScreen} />
      <Tab.Screen name="RoutesTab" component={RoutesScreen} />
      <Tab.Screen name="VerifyTab" component={VerificationScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 99,
  },
  glassTabBar: {
    flexDirection: 'row',
    width: '100%',
    height: 64,
    backgroundColor: 'rgba(9, 13, 22, 0.94)',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  tabBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    paddingVertical: 6,
  },
  tabLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  tabLabelActive: {
    color: COLORS.skyBlue,
    fontWeight: '800',
  },
  sosTabBtnContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    top: -10,
  },
  sosBadgeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sosTabLabel: {
    color: COLORS.danger,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 2,
  },
});
