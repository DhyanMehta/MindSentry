import { Dimensions, Platform } from 'react-native';

/**
 * Responsive design utilities for MindSentry
 * Handles different screen sizes and devices
 */

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Define device breakpoints
const BREAKPOINTS = {
  SMALL: 320,    // Small phones (iPhone SE)
  MEDIUM: 375,   // Standard phones (iPhone 12)
  LARGE: 414,    // Large phones (iPhone 14 Plus, Pixel 6)
  XLARGE: 480,   // Extra large phones (Pixel XL)
  TABLET: 768,   // Tablets (iPad Mini)
  DESKTOP: 1024, // Desktop/iPad Pro
};

/**
 * Get current device category based on screen width
 */
export const getDeviceType = () => {
  if (SCREEN_WIDTH < BREAKPOINTS.SMALL) return 'extraSmall';
  if (SCREEN_WIDTH < BREAKPOINTS.MEDIUM) return 'small';
  if (SCREEN_WIDTH < BREAKPOINTS.LARGE) return 'medium';
  if (SCREEN_WIDTH < BREAKPOINTS.XLARGE) return 'large';
  if (SCREEN_WIDTH < BREAKPOINTS.TABLET) return 'extraLarge';
  if (SCREEN_WIDTH < BREAKPOINTS.DESKTOP) return 'tablet';
  return 'desktop';
};

/**
 * Scale values based on screen width
 * Base scale is for 375px (medium) devices
 */
export const scale = (size) => {
  const baseWidth = BREAKPOINTS.MEDIUM;
  return (SCREEN_WIDTH / baseWidth) * size;
};

/**
 * Scale values based on screen height
 */
export const verticalScale = (size) => {
  const baseHeight = 812; // iPhone X height
  return (SCREEN_HEIGHT / baseHeight) * size;
};

/**
 * Moderate scale - use for most spacing and sizing
 */
export const moderateScale = (size, factor = 0.5) => {
  return size + (scale(size) - size) * factor;
};

/**
 * Responsive font size
 */
export const responsiveFontSize = (baseSize) => {
  const scale = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / 375;
  return Math.round(baseSize * scale);
};

/**
 * Responsive padding/margin
 */
export const responsiveSize = {
  // Extra small spacing
  xs: moderateScale(4),
  // Small spacing
  sm: moderateScale(8),
  // Medium spacing
  md: moderateScale(12),
  // Standard spacing
  base: moderateScale(16),
  // Large spacing
  lg: moderateScale(24),
  // Extra large spacing
  xl: moderateScale(32),
  // Double extra large
  xxl: moderateScale(48),
};

/**
 * Responsive border radius
 */
export const borderRadius = {
  small: moderateScale(4),
  medium: moderateScale(8),
  large: moderateScale(12),
  extraLarge: moderateScale(16),
  round: 999,
};

/**
 * Responsive shadow styles
 */
export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
};

/**
 * Responsive container widths
 */
export const getContainerWidth = () => {
  const maxWidth = 600; // Max width for tablets/desktop
  const padding = responsiveSize.base * 2;
  return Math.min(SCREEN_WIDTH - padding, maxWidth);
};

/**
 * Get responsive grid columns based on device
 */
export const getGridColumns = () => {
  const deviceType = getDeviceType();
  
  switch (deviceType) {
    case 'small':
    case 'medium':
    case 'large':
      return 1; // Single column on phones
    case 'extraLarge':
    case 'tablet':
      return 2; // Two columns on tablets
    case 'desktop':
      return 3; // Three columns on desktop
    default:
      return 1;
  }
};

/**
 * Check if device is in portrait mode
 */
export const isPortrait = () => SCREEN_HEIGHT > SCREEN_WIDTH;

/**
 * Check if device is tablet or larger
 */
export const isTablet = () => SCREEN_WIDTH >= BREAKPOINTS.TABLET;

/**
 * Check if device is phone
 */
export const isPhone = () => SCREEN_WIDTH < BREAKPOINTS.TABLET;

/**
 * Responsive button dimensions
 */
export const buttonDimensions = {
  height: moderateScale(50),
  width: '100%',
  minWidth: moderateScale(120),
  paddingVertical: moderateScale(14),
  paddingHorizontal: moderateScale(24),
};

/**
 * Responsive input dimensions
 */
export const inputDimensions = {
  height: moderateScale(50),
  paddingHorizontal: moderateScale(16),
  paddingVertical: moderateScale(12),
  borderRadius: borderRadius.medium,
  marginBottom: moderateScale(16),
};

/**
 * Get responsive margins/padding for lists
 */
export const getListPadding = () => ({
  horizontal: responsiveSize.base,
  vertical: responsiveSize.md,
});

/**
 * Get responsive card dimensions
 */
export const cardDimensions = {
  padding: responsiveSize.base,
  borderRadius: borderRadius.large,
  marginBottom: responsiveSize.md,
};

/**
 * Responsive font sizes
 */
export const fontSize = {
  h1: responsiveFontSize(32),
  h2: responsiveFontSize(28),
  h3: responsiveFontSize(24),
  h4: responsiveFontSize(20),
  h5: responsiveFontSize(18),
  h6: responsiveFontSize(16),
  body: responsiveFontSize(14),
  small: responsiveFontSize(12),
  tiny: responsiveFontSize(10),
};

/**
 * Get responsive line height
 */
export const getLineHeight = (size) => {
  if (size >= fontSize.h1) return 1.2;
  if (size >= fontSize.h3) return 1.3;
  if (size >= fontSize.body) return 1.5;
  return 1.6;
};

/**
 * Responsive image dimensions
 */
export const imageDimensions = {
  avatarSmall: moderateScale(40),
  avatarMedium: moderateScale(56),
  avatarLarge: moderateScale(80),
  iconSmall: moderateScale(20),
  iconMedium: moderateScale(24),
  iconLarge: moderateScale(32),
  bannerHeight: moderateScale(200),
};

/**
 * Hook for listening to dimension changes
 */
export const useResponsive = () => {
  return {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    scale,
    verticalScale,
    moderateScale,
    responsiveFontSize,
    responsiveSize,
    deviceType: getDeviceType(),
    isPhone: isPhone(),
    isTablet: isTablet(),
    isPortrait: isPortrait(),
  };
};

// Export constants
export { SCREEN_WIDTH, SCREEN_HEIGHT, BREAKPOINTS };
