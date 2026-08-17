import { createTheme } from '@mui/material/styles';

export const designTokens = {
  // Primary: deep clinical blue (WCAG AA on white backgrounds)
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  primaryLight: '#E3F2FD',

  // Secondary: muted clinical teal
  secondary: '#00838F',
  secondaryLight: '#E0F7FA',

  // Accent: blue-grey (replaces purple — neutral, professional)
  accent: '#546E7A',

  // Surfaces
  background: '#F0F4F8',   // cool pale grey — calmer than pure #F8FAFC
  backgroundAlt: '#EFF6FF', // very light blue tint for side panels
  paper: '#FFFFFF',

  // Text
  textPrimary: '#1A2B4A',  // deep navy — slightly warmer than #0F172A
  textSecondary: '#546E7A',
  textMuted: '#90A4AE',

  // Borders
  border: '#CFD8DC',        // cool grey border — replaces warm #E2E8F0
  borderFocus: '#1565C0',

  // Utilities
  borderRadius: 12,
  inputRadius: 6,
  buttonRadius: 6,
  cardShadow: '0px 1px 4px rgba(21, 101, 192, 0.08), 0px 4px 16px rgba(21, 101, 192, 0.06)',
  glassBackground: 'rgba(255, 255, 255, 0.90)',
};

export const theme = createTheme({
  palette: {
    primary: {
      main: designTokens.primary,
      dark: designTokens.primaryDark,
      light: designTokens.primaryLight,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: designTokens.secondary,
      light: designTokens.secondaryLight,
      contrastText: '#FFFFFF',
    },
    background: {
      default: designTokens.background,
      paper: designTokens.paper,
    },
    text: {
      primary: designTokens.textPrimary,
      secondary: designTokens.textSecondary,
    },
    divider: designTokens.border,
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.015em',
    },
    h3: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: designTokens.borderRadius,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.buttonRadius,
          padding: '10px 24px',
          boxShadow: 'none',
          transition: 'all 0.15s ease',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(21, 101, 192, 0.20)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        containedPrimary: {
          backgroundColor: designTokens.primary,
          '&:hover': {
            backgroundColor: designTokens.primaryDark,
          },
        },
        outlinedPrimary: {
          borderColor: designTokens.border,
          '&:hover': {
            borderColor: designTokens.primary,
            backgroundColor: designTokens.primaryLight,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.borderRadius,
          boxShadow: designTokens.cardShadow,
          border: `1px solid ${designTokens.border}`,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.inputRadius,
          backgroundColor: '#FFFFFF',
          '& fieldset': {
            borderColor: designTokens.border,
          },
          '&:hover fieldset': {
            borderColor: designTokens.primary,
          },
          '&.Mui-focused fieldset': {
            borderColor: designTokens.borderFocus,
            borderWidth: '2px',
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          color: designTokens.textSecondary,
          '&.Mui-focused': {
            color: designTokens.primary,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.inputRadius,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: designTokens.borderRadius,
        },
      },
    },
  },
});
