import { View, Text, StyleSheet } from 'react-native';

export default function ModuleVoiceScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Stress (Placeholder)</Text>
      <Text style={styles.subtitle}>
        Planned: short voice clips to assess stress and vocal tension patterns.
      </Text>
      <View style={styles.card}>
        <Text style={styles.label}>Next steps:</Text>
        <Text style={styles.item}>• Record/upload 15-30s clips</Text>
        <Text style={styles.item}>• Acoustic feature extraction</Text>
        <Text style={styles.item}>• Stress score + trend tracking</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
    padding: 20,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#b5c3ff',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#141a33',
    borderRadius: 12,
    padding: 16,
  },
  label: {
    color: '#e0e7ff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  item: {
    color: '#c3ceff',
    fontSize: 13,
    marginBottom: 6,
  },
});

