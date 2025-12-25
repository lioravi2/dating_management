'use client';

import { renderTextWithLinks } from '@/lib/text-utils';

interface DescriptionWithLinksProps {
  text: string | null | undefined;
  className?: string;
  insideLink?: boolean; // If true, uses span with onClick instead of <a> to avoid nested links
}

export default function DescriptionWithLinks({ text, className, insideLink = false }: DescriptionWithLinksProps) {
  if (!text) return null;
  
  return (
    <span className={className}>
      {renderTextWithLinks(text, insideLink)}
    </span>
  );
}

