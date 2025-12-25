import React from 'react';

/**
 * Renders text with clickable URLs that open in a new tab
 * @param text - The text to render
 * @param insideLink - If true, uses span with onClick instead of <a> to avoid nested links
 */
export function renderTextWithLinks(text: string, insideLink: boolean = false): React.ReactNode {
  if (!text) return null;

  // URL regex pattern - matches http, https, www, and common domains
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add the URL as a clickable link
    let url = match[0];
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    if (insideLink) {
      // Use span with onClick to avoid nested <a> tags (invalid HTML)
      parts.push(
        <span
          key={key++}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
          className="text-blue-600 hover:text-blue-800 underline break-all cursor-pointer"
        >
          {match[0]}
        </span>
      );
    } else {
      parts.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {match[0]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // If no URLs found, return original text
  if (parts.length === 0) {
    return text;
  }

  return <>{parts}</>;
}

