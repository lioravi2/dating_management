'use client';

import { useNavigation } from '@/lib/navigation';

export default function BackButton() {
  const navigation = useNavigation();

  return (
    <button
      onClick={() => navigation.goBack()}
      className="text-primary-600 hover:text-primary-700 flex items-center"
    >
      ← Back
    </button>
  );
}







