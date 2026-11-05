import { StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
  note?: string;
};

// Temporary screen used by routes that are not implemented yet.
export function PlaceholderScreen({ title, note }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <Text style={styles.badge}>Belum tersedia</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  note: {
    marginTop: 8,
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
  },
  badge: {
    marginTop: 16,
    fontSize: 13,
    color: '#9CA3AF',
  },
});
