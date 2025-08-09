import React from 'react';

const Logo: React.FC = () => (
  <svg
    width="250"
    height="52"
    viewBox="0 0 430 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Precision for Medicine Logo"
  >
    <text
      x="0"
      y="35"
      fontFamily="serif"
      fontSize="40"
      fill="#2D445D"
      letterSpacing="1"
    >
      PRECISION
    </text>
    <text
      x="0"
      y="72"
      fontFamily="serif"
      fontSize="34"
      fill="#B58F2E"
    >
      for medicine
    </text>
    <polygon
      points="320,0 430,80 320,80"
      fill="#B58F2E"
    />
  </svg>
);

export default Logo;