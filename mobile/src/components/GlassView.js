import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

export const GlassView = ({ children, style, borderRadius = 16, intensity = 'medium', ...props }) => {
  const getBgColor = () => {
    switch (intensity) {
      case 'high':
        return 'rgba(15, 23, 42, 0.9)';
      case 'low':
        return 'rgba(30, 41, 59, 0.45)';
      default:
        return 'rgba(30, 41, 59, 0.68)';
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: getBgColor(),
          borderRadius,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderColor: COLORS.borderGlass,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
