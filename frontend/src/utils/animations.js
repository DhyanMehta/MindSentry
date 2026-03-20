/**
 * Animation utilities and constants for MindSentry
 * Centralizes animation configurations to reduce duplication and improve maintainability
 */

import Animated, { Easing, FadeIn, ZoomIn } from 'react-native-reanimated';

/**
 * Animation easing configurations
 */
export const ANIMATION_EASINGS = {
  smooth: Easing.out(Easing.cubic),
  easeIn: Easing.in(Easing.cubic),
  easeInOut: Easing.inOut(Easing.cubic),
};

/**
 * Standard animation durations (in milliseconds)
 */
export const ANIMATION_DURATIONS = {
  fast: 300,
  standard: 400,
  slow: 500,
  extraSlow: 600,
};

/**
 * Animation delay increments for staggered animations
 */
export const ANIMATION_DELAYS = {
  none: 0,
  short: 50,
  medium: 100,
  long: 150,
  extraLong: 300,
};

/**
 * Create a fade-in animation with standard easing
 * @param {number} duration - Duration in ms (default: 400)
 * @param {number} delay - Delay in ms (default: 0)
 * @returns {object} Animated entering prop
 */
export const fadeIn = (duration = ANIMATION_DURATIONS.standard, delay = ANIMATION_DELAYS.none) =>
  FadeIn.duration(duration).delay(delay).easing(ANIMATION_EASINGS.smooth);

/**
 * Create a fade-in animation (bottom slide removed) with standard easing
 * @param {number} duration - Duration in ms (default: 400)
 * @param {number} delay - Delay in ms (default: 0)
 * @returns {object} Animated entering prop
 */
export const slideInDown = (duration = ANIMATION_DURATIONS.standard, delay = ANIMATION_DELAYS.none) =>
  FadeIn.duration(duration).delay(delay).easing(ANIMATION_EASINGS.smooth);

/**
 * Create a fade-in animation (bottom slide removed) with standard easing
 * @param {number} duration - Duration in ms (default: 400)
 * @param {number} delay - Delay in ms (default: 0)
 * @returns {object} Animated entering prop
 */
export const slideInUp = (duration = ANIMATION_DURATIONS.standard, delay = ANIMATION_DELAYS.none) =>
  FadeIn.duration(duration).delay(delay).easing(ANIMATION_EASINGS.smooth);

/**
 * Create a zoom-in animation with standard easing
 * @param {number} duration - Duration in ms (default: 400)
 * @param {number} delay - Delay in ms (default: 0)
 * @returns {object} Animated entering prop
 */
export const zoomIn = (duration = ANIMATION_DURATIONS.standard, delay = ANIMATION_DELAYS.none) =>
  ZoomIn.duration(duration).delay(delay).easing(ANIMATION_EASINGS.smooth);

/**
 * Calculate staggered delay for list items
 * @param {number} index - Item index in list
 * @param {number} baseDelay - Base delay before staggering starts
 * @param {number} increment - Delay increment per item
 * @returns {number} Calculated delay in ms
 */
export const getStaggeredDelay = (
  index,
  baseDelay = ANIMATION_DELAYS.none,
  increment = ANIMATION_DELAYS.short
) => baseDelay + (index * increment);

/**
 * Preset animation sequences for common use cases
 */
export const ANIMATION_PRESETS = {
  // Auth screens: header fades in, form slides up
  authHeader: () => fadeIn(ANIMATION_DURATIONS.standard, ANIMATION_DELAYS.none),
  authForm: () => slideInDown(ANIMATION_DURATIONS.standard, ANIMATION_DELAYS.medium),

  // Dashboard: hero card slides, metrics stagger
  dashboardHero: () => slideInDown(ANIMATION_DURATIONS.standard, ANIMATION_DELAYS.short),
  dashboardSection: (index) => fadeIn(ANIMATION_DURATIONS.standard, getStaggeredDelay(index, ANIMATION_DELAYS.long, 50)),

  // Onboarding: full page stagger
  onboardingLogo: () => fadeIn(ANIMATION_DURATIONS.slow, ANIMATION_DELAYS.none),
  onboardingText: () => fadeIn(ANIMATION_DURATIONS.slow, ANIMATION_DELAYS.long),
  onboardingButton: () => slideInUp(ANIMATION_DURATIONS.slow, ANIMATION_DELAYS.extraLong),
};
