import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function PRBadge() {
  return (
    <View style={styles.badge}>
      <Ionicons name="star" size={10} color="#FFF" />
      <Text style={styles.text}>NEW PR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FF9800',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  text: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
});
