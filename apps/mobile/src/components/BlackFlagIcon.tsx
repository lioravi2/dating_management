import React from 'react';
import Svg, { Line, Path } from 'react-native-svg';

interface BlackFlagIconProps {
  width?: number;
  height?: number;
  color?: string;
}

/**
 * Black Flag Icon Component
 * Matches the web app's SVG flag icon: vertical pole with triangular flag
 */
export default function BlackFlagIcon({ 
  width = 16, 
  height = 16, 
  color = 'currentColor' 
}: BlackFlagIconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Flagpole - vertical line from (4,4) to (4,20) */}
      <Line
        x1={4}
        y1={4}
        x2={4}
        y2={20}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* Flag - triangular path: M4 4 L16 8 L4 12 Z */}
      <Path
        d="M4 4 L16 8 L4 12 Z"
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    </Svg>
  );
}

