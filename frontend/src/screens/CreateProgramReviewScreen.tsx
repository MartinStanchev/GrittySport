import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ApiError, createProgram } from '../services/api';
import { useProgram } from '../contexts/ProgramContext';
import { ProposalReviewView } from '../components/ProposalReviewView';
import type { ProgramProposalData } from '../components/ProgramProposalCard';

interface Props {
  navigation: any;
  route: any;
}

export default function CreateProgramReviewScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { name, sport, goal, startDate, endDate, phases } = route.params;
  const { notifyProgramDataChanged } = useProgram();
  const [saving, setSaving] = useState(false);

  const proposalData: ProgramProposalData = {
    name,
    sport,
    goal_description: goal,
    start_date: startDate,
    end_date: endDate,
    phases,
  };

  const handleCreate = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await createProgram({
        name,
        sport,
        goal_description: goal,
        start_date: startDate,
        end_date: endDate,
        phases,
      });
      await notifyProgramDataChanged();
      navigation.navigate('ProgramDetail', { programId: result.id });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        Alert.alert(
          'Program Limit Reached',
          'Free accounts are limited to 1 program. Upgrade to premium for unlimited programs.',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Upgrade (Coming Soon)', onPress: () => Alert.alert('Coming Soon', 'Premium subscriptions will be available soon!') },
          ],
        );
      } else {
        Alert.alert('Error', 'Failed to create program. Please try again.');
      }
      if (__DEV__) console.error('[CreateProgram] error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ProposalReviewView
        data={proposalData}
        onAccept={handleCreate}
        onBack={() => navigation.goBack()}
        disabled={saving}
        byline={null}
        headerTitle="Review the blueprint"
        acceptLabel={saving ? 'CREATING…' : 'CREATE PROGRAM'}
      />
    </View>
  );
}
