import { View, Text, StyleSheet } from 'react-native';

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard (Placeholder)</Text>
      <Text style={styles.subtitle}>
        Planned: wellness score, trends, anomalies, sleep estimates, and alerts.
      </Text>
      <View style={styles.card}>
        <Text style={styles.label}>Coming soon:</Text>
        <Text style={styles.item}>• Mental Wellness Score (0–100)</Text>
        <Text style={styles.item}>• 7/30-day mood & stress trends</Text>
        <Text style={styles.item}>• Anomaly alerts & early warnings</Text>
        <Text style={styles.item}>• Sleep quality estimates</Text>
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

