import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Settings</Text>
      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
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
  logoutButton: {
    marginTop: 32,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  logoutText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
});
