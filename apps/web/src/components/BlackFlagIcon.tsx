/**
 * Black Flag Icon Component
 * Simple SVG icon representing a black flag
 */
export default function BlackFlagIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Flagpole */}
      <line
        x1="4"
        y1="4"
        x2="4"
        y2="20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Flag */}
      <path
        d="M4 4 L16 8 L4 12 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

