import { useLegacyData } from '../hooks/useLegacyData';
export function LegacyChart() {
  return <div>{useLegacyData()}</div>;
}
