import { StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

export const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 48,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.tabBarBorder,
  },
  error: {
    color: Colors.primary,
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    alignItems: 'center',
    marginTop: 16,
  },
  linkText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  linkBold: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
