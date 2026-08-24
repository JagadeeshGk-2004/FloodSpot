import React from 'react';
import { StyleSheet, View, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import { COLORS } from './src/theme/colors';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={COLORS.bgDark} translucent={false} />
      <NavigationContainer>
        <BottomTabNavigator />
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
});
