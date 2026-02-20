import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const emotionColors = {
  Calm: colors.vibrantBlue,
  Happy: colors.vibrantPurple,
  Focused: colors.primary,
  Stressed: colors.danger,
  Tired: colors.accent,
};

const hexToRgba = (hex, alpha = 1) => {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const EmotionBadge = ({ label = 'Calm' }) => {
  const base = emotionColors[label] || colors.secondary;
  const bg = hexToRgba(base, 0.08);
  const border = hexToRgba(base, 0.16);
  return (
    <View style={[styles.container, { backgroundColor: bg, borderColor: border }]}> 
      <Text style={[styles.text, { color: base }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignSelf: 'flex-start',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  text: {
    ...typography.body,
    fontWeight: '600',
  },
});
