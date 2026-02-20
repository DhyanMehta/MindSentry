import React from 'react';
import { View, StyleSheet, Dimensions, Pressable } from 'react-native';
import { responsiveSize, getGridColumns, isTablet, SCREEN_WIDTH } from '../utils/responsive';

/**
 * Responsive grid layout component
 * Automatically adjusts columns based on screen size
 */
export const ResponsiveGrid = ({ 
  children, 
  spacing = responsiveSize.md,
  numColumns = null,
  style,
}) => {
  const columns = numColumns || getGridColumns();
  const itemWidth = (SCREEN_WIDTH - (spacing * (columns + 1))) / columns;

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: spacing,
      paddingVertical: spacing / 2,
    },
    item: {
      width: itemWidth,
      marginVertical: spacing / 2,
      marginHorizontal: spacing / 2,
    },
  });

  return (
    <View style={[styles.container, style]}>
      {React.Children.map(children, (child) => (
        <View style={styles.item}>
          {child}
        </View>
      ))}
    </View>
  );
};

/**
 * Responsive list component
 * Handles spacing automatically based on device
 */
export const ResponsiveList = ({
  data,
  renderItem,
  keyExtractor,
  spacing = responsiveSize.md,
  contentContainerStyle,
  ...props
}) => {
  const styles = StyleSheet.create({
    container: {
      paddingHorizontal: responsiveSize.base,
      paddingVertical: spacing,
      gap: spacing,
    },
  });

  return (
    <View style={[styles.container, contentContainerStyle]}>
      {data.map((item, index) => (
        <View key={keyExtractor ? keyExtractor(item) : index}>
          {renderItem({ item, index })}
        </View>
      ))}
    </View>
  );
};

/**
 * Responsive flex container
 * Adjusts flex direction and spacing based on screen size
 */
export const ResponsiveFlex = ({
  direction = 'column',
  children,
  spacing = responsiveSize.md,
  style,
  alignItems = 'center',
  justifyContent = 'center',
  ...props
}) => {
  // On tablets, switch to horizontal layout if specified
  const flexDirection = isTablet() && direction === 'row' ? 'row' : 'column';

  const styles = StyleSheet.create({
    container: {
      flexDirection,
      gap: spacing,
      alignItems,
      justifyContent,
    },
  });

  return (
    <View style={[styles.container, style]} {...props}>
      {children}
    </View>
  );
};

/**
 * Responsive safe area with consistent padding
 */
export const ResponsiveContainer = ({
  children,
  horizontal = true,
  vertical = true,
  style,
  spacing = responsiveSize.base,
}) => {
  const styles = StyleSheet.create({
    container: {
      paddingHorizontal: horizontal ? spacing : 0,
      paddingVertical: vertical ? spacing : 0,
    },
  });

  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
};

/**
 * Responsive card component
 */
export const ResponsiveCard = ({
  children,
  onPress,
  style,
  padding = responsiveSize.base,
  borderRadius = 12,
}) => {
  const { colors } = require('../theme/colors');

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      padding,
      borderRadius,
      marginBottom: responsiveSize.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 6,
      borderWidth: 0,
    },
  });

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[styles.card, style]}>
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
};
