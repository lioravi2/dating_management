'use client';

import { APP_VERSION, BUILD_NUMBER } from '@/lib/version';

export default function VersionFooter() {
  return (
    <div className="fixed bottom-0 right-0 p-2 text-xs text-gray-400">
      v{APP_VERSION} (build {BUILD_NUMBER})
    </div>
  );
}

