import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');

/**
 * Skeleton loader for text content
 */
export const SkeletonText = ({ width: customWidth = '80%', height = 16, style, ...props }) => {
  const skeletonWidth = typeof customWidth === 'number' ? customWidth : undefined;
  
  return (
    <View
      style={[
        styles.skeleton,
        {
          width: skeletonWidth || customWidth,
          height,
        },
        style,
      ]}
      {...props}
    />
  );
};

/**
 * Skeleton loader for image/avatar
 */
export const SkeletonAvatar = ({ size = 50, style, ...props }) => {
  return (
    <View
      style={[
        styles.skeleton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
      {...props}
    />
  );
};

/**
 * Skeleton loader for card content
 */
export const SkeletonCard = ({ style, ...props }) => {
  return (
    <View style={[styles.card, style]} {...props}>
      <SkeletonText width="80%" height={20} style={{ marginBottom: 12 }} />
      <SkeletonText width="100%" height={16} style={{ marginBottom: 8 }} />
      <SkeletonText width="95%" height={16} style={{ marginBottom: 8 }} />
      <SkeletonText width="70%" height={16} />
    </View>
  );
};

/**
 * Skeleton for DashboardScreen
 */
export const DashboardSkeleton = () => {
  return (
    <View style={styles.container}>
      {/* Header skeleton */}
      <View style={styles.headerSkeleton}>
        <SkeletonText width={200} height={28} style={{ marginBottom: 8 }} />
        <SkeletonText width={150} height={16} />
      </View>

      {/* Emotion card skeleton */}
      <SkeletonCard style={{ marginHorizontal: 20, marginBottom: 24 }} />

      {/* Stats section skeleton */}
      <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
        <SkeletonText width={120} height={20} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <SkeletonCard style={{ flex: 0.48, marginBottom: 0 }} />
          <SkeletonCard style={{ flex: 0.48, marginBottom: 0 }} />
        </View>
      </View>

      {/* Recent activity skeleton */}
      <View style={{ marginHorizontal: 20 }}>
        <SkeletonText width={120} height={20} style={{ marginBottom: 12 }} />
        <SkeletonCard style={{ marginBottom: 12 }} />
        <SkeletonCard style={{ marginBottom: 12 }} />
        <SkeletonCard />
      </View>
    </View>
  );
};

/**
 * Skeleton for CheckInScreen
 */
export const CheckInSkeleton = () => {
  return (
    <View style={styles.container}>
      <SkeletonText width={200} height={28} style={{ marginHorizontal: 20, marginBottom: 24 }} />

      {/* Mood selector skeleton */}
      <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
        <SkeletonText width={100} height={20} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonAvatar key={i} size={50} />
          ))}
        </View>
      </View>

      {/* Intensity skeleton */}
      <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
        <SkeletonText width={100} height={20} style={{ marginBottom: 12 }} />
        <SkeletonText width="100%" height={40} />
      </View>

      {/* Message skeleton */}
      <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
        <SkeletonText width={100} height={20} style={{ marginBottom: 12 }} />
        <SkeletonText width="100%" height={100} />
      </View>

      {/* Button skeleton */}
      <View style={{ marginHorizontal: 20 }}>
        <SkeletonText width="100%" height={50} />
      </View>
    </View>
  );
};

/**
 * Skeleton for InsightsScreen
 */
export const InsightsSkeleton = () => {
  return (
    <View style={styles.container}>
      <SkeletonText width={200} height={28} style={{ marginHorizontal: 20, marginBottom: 24 }} />

      {/* Chart skeleton */}
      <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
        <SkeletonCard style={{ height: 250, marginBottom: 0 }} />
      </View>

      {/* Insights list skeleton */}
      <View style={{ marginHorizontal: 20 }}>
        <SkeletonText width={150} height={20} style={{ marginBottom: 12 }} />
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} style={{ marginBottom: 12 }} />
        ))}
      </View>
    </View>
  );
};

/**
 * Skeleton for CounselorChatScreen
 */
export const ChatSkeleton = () => {
  return (
    <View style={styles.container}>
      {/* Messages skeleton */}
      <View style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 12 }}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              marginBottom: 12,
              alignItems: i % 2 === 0 ? 'flex-start' : 'flex-end',
            }}
          >
            <SkeletonText width={width * 0.6} height={16} />
          </View>
        ))}
      </View>

      {/* Input area skeleton */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <SkeletonText width="100%" height={50} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.card,
    borderRadius: 8,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: 20,
  },
  headerSkeleton: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
});
