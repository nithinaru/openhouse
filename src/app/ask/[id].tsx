import { useLocalSearchParams } from 'expo-router';

import { AskSheet } from '@/features/ask/AskSheet';
import { useTrip } from '@/features/replay/useTrip';

// "Ask your day" sheet over a trip. Optional ?q= asks straight away.
export default function AskScreen() {
  const { id, q } = useLocalSearchParams<{ id: string; q?: string }>();
  const trip = useTrip(id);
  return <AskSheet trip={trip} initialQuestion={q} />;
}
