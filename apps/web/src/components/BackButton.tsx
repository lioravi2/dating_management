'use client';

import { useRouter } from 'next/navigation';

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="text-primary-600 hover:text-primary-700 flex items-center"
    >
      ← Back
    </button>
  );
}







