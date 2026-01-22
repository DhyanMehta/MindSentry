import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const emotionColors = {
  Calm: '#00C48C',
  Happy: '#6C5CE7',
  Focused: '#00B0FF',
  Stressed: '#FF6B6B',
  Tired: '#F9A825',
};

export const EmotionBadge = ({ label = 'Calm' }) => {
  const background = emotionColors[label] || colors.secondary;
  return (
    <View style={[styles.container, { backgroundColor: `${background}26`, borderColor: `${background}66` }]}>
      <Text style={[styles.text, { color: background }]}>{label}</Text>
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
