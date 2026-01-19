import { View, Text, StyleSheet } from 'react-native';

export default function ModuleTextScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Text Analysis (Placeholder)</Text>
      <Text style={styles.subtitle}>
        Planned: sentiment, emotion, and stress detection on journals/chats.
      </Text>
      <View style={styles.card}>
        <Text style={styles.label}>Next steps:</Text>
        <Text style={styles.item}>• Input box for daily reflections</Text>
        <Text style={styles.item}>• NLP pipeline (sentiment, emotion)</Text>
        <Text style={styles.item}>• Stress index + explanations</Text>
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

