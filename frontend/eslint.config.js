// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // React Compiler rules arrived with eslint-config-expo 58 and flag existing patterns
    // (mostly the "latest value ref" assigned during render). The compiler is not enabled,
    // so these files are warnings-only until migrated; remove a file once it is clean.
    // Everything else keeps the rules as errors.
    files: [
      "src/components/CriteriaEditorModal.tsx",
      "src/components/DatePickerSheet.tsx",
      "src/components/DeleteAccountModal.tsx",
      "src/components/FABActionSheet.tsx",
      "src/components/HRSensorModal.tsx",
      "src/components/PostWorkoutReview.tsx",
      "src/components/ProgramArc.tsx",
      "src/components/WorkoutCharts.tsx",
      "src/components/YearPickerSheet.tsx",
      "src/contexts/AuthContext.tsx",
      "src/contexts/ProgramContext.tsx",
      "src/contexts/ToastContext.tsx",
      "src/contexts/WorkoutContext.tsx",
      "src/hooks/useChatWebSocket.ts",
      "src/hooks/useHRAutoConnect.ts",
      "src/hooks/useUsage.ts",
      "src/screens/ActivityDetailScreen.tsx",
      "src/screens/HomeScreen.tsx",
      "src/screens/ProgramDetailScreen.tsx",
      "src/screens/RecordGPSScreen.tsx",
      "src/screens/RecordManualScreen.tsx",
      "src/screens/WorkoutDetailScreen.tsx",
      "src/utils/setDetection.ts",
    ],
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);
