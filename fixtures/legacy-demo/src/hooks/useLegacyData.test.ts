import { useLegacyData } from './useLegacyData';
if (useLegacyData() !== 42) throw new Error('Unexpected data');
