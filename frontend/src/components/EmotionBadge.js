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

export const EmotionBadge = ({ label = 'Calm' }) => {
  const base = emotionColors[label] || colors.secondary;
  // expect hex like #RRGGBB - append alpha for light background
  const bg = base + '26';
  const border = base + '66';
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
  },
  text: {
    ...typography.body,
    fontWeight: '600',
  },
});
