import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

export const GlassView = ({ children, style, borderRadius = 16, intensity = 'medium', ...props }) => {
  const getBgColor = () => {
    switch (intensity) {
      case 'high':
        return '#111827';
      case 'low':
        return 'rgba(17, 24, 39, 0.75)';
      default:
        return 'rgba(17, 24, 39, 0.92)';
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
    borderColor: COLORS.border,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
