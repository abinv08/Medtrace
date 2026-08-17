import React from 'react';
import { Box, Typography } from '@mui/material';

interface LogoProps {
  variant?: 'full' | 'icon';
  size?: 'small' | 'medium' | 'large';
}

export const MedTraceLogo: React.FC<LogoProps> = ({ variant = 'full', size = 'medium' }) => {
  const iconSizes = { small: 32, medium: 42, large: 56 };
  const textSizes = { small: '1.2rem', medium: '1.5rem', large: '2rem' };

  const s = iconSizes[size];

  return (
    <Box display="flex" alignItems="center" gap={1.5}>
      {/* MedTrace Vector Logo: Medical Cross + AI Circuit Dots + Heartbeat Line */}
      <svg
        width={s}
        height={s}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: 'drop-shadow(0px 4px 12px rgba(37, 99, 235, 0.3))' }}
      >
        <defs>
          <linearGradient id="medGrad" x1="0" y1="0" x2="100" y2="100">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="50%" stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>

        {/* Outer Rounded Container */}
        <rect x="5" y="5" width="90" height="90" rx="24" fill="url(#medGrad)" />

        {/* Medical Cross Path */}
        <path
          d="M50 22V78M22 50H78"
          stroke="#FFFFFF"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* AI Circuit Nodes */}
        <circle cx="50" cy="22" r="5" fill="#14B8A6" stroke="#FFFFFF" strokeWidth="2" />
        <circle cx="50" cy="78" r="5" fill="#8B5CF6" stroke="#FFFFFF" strokeWidth="2" />
        <circle cx="22" cy="50" r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
        <circle cx="78" cy="50" r="5" fill="#14B8A6" stroke="#FFFFFF" strokeWidth="2" />

        {/* Heartbeat Pulse Line across center */}
        <path
          d="M25 50 H38 L44 32 L54 68 L60 42 L66 50 H75"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {variant === 'full' && (
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontSize: textSizes[size],
              fontWeight: 800,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #0F172A 0%, #2563EB 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.1,
            }}
          >
            MEDTRACE
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#64748B',
              fontWeight: 600,
              fontSize: '0.65rem',
              letterSpacing: '0.05em',
              display: 'block',
              textTransform: 'uppercase',
            }}
          >
            Clinical Intelligence
          </Typography>
        </Box>
      )}
    </Box>
  );
};
