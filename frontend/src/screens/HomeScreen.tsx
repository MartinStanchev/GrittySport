import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Home</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  text: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
