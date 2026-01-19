import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to MindSentry</Text>
      <Text style={styles.subtitle}>
        AI-Based Multi-Modal Mental Health Monitoring & Early Intervention
      </Text>
      <View style={styles.list}>
        <Text style={styles.item}>• Track emotions, stress, and trends</Text>
        <Text style={styles.item}>• Combine text, voice, and face insights</Text>
        <Text style={styles.item}>• Receive supportive guidance</Text>
      </View>
      <Text style={styles.footer}>Explore modules via the bottom tabs.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#b5c3ff',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  list: {
    marginBottom: 16,
  },
  item: {
    color: '#c3ceff',
    fontSize: 14,
    marginBottom: 6,
  },
  footer: {
    color: '#8892ff',
    fontSize: 12,
  },
});

