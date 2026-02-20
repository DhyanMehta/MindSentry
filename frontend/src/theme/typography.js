import { fontSize as responsiveFontSize, getLineHeight } from '../utils/responsive';

export const typography = {
  h1: {
    fontSize: responsiveFontSize.h1,
    fontWeight: '800',
    lineHeight: responsiveFontSize.h1 * getLineHeight(responsiveFontSize.h1),
  },
  h2: {
    fontSize: responsiveFontSize.h2,
    fontWeight: '700',
    lineHeight: responsiveFontSize.h2 * getLineHeight(responsiveFontSize.h2),
  },
  h3: {
    fontSize: responsiveFontSize.h3,
    fontWeight: '700',
    lineHeight: responsiveFontSize.h3 * getLineHeight(responsiveFontSize.h3),
  },
  h4: {
    fontSize: responsiveFontSize.h4,
    fontWeight: '600',
    lineHeight: responsiveFontSize.h4 * getLineHeight(responsiveFontSize.h4),
  },
  body: {
    fontSize: responsiveFontSize.body,
    fontWeight: '400',
    lineHeight: responsiveFontSize.body * getLineHeight(responsiveFontSize.body),
  },
  small: {
    fontSize: responsiveFontSize.small,
    fontWeight: '400',
    lineHeight: responsiveFontSize.small * getLineHeight(responsiveFontSize.small),
  },
  tiny: {
    fontSize: responsiveFontSize.tiny,
    fontWeight: '400',
    lineHeight: responsiveFontSize.tiny * getLineHeight(responsiveFontSize.tiny),
  },
};
