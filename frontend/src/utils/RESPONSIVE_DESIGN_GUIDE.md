# Responsive Design Implementation Guide

## Overview

MindSentry is now fully responsive across all device sizes:
- **Small phones** (320px - iPhone SE)
- **Medium phones** (375px - iPhone 12)
- **Large phones** (414px - iPhone 14 Plus)
- **Extra large phones** (480px+)
- **Tablets** (768px - iPad Mini)
- **Desktop** (1024px+ - iPad Pro)

---

## How to Use Responsive Design

### 1. Import Responsive Utilities

```javascript
import { 
  responsiveSize, 
  fontSize, 
  imageDimensions,
  inputDimensions,
  buttonDimensions,
  borderRadius,
  isTablet,
  scale,
  moderateScale
} from '../utils/responsive';
```

### 2. Responsive Spacing

Use `responsiveSize` for all spacing:

```javascript
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: responsiveSize.base,    // ~16px
    marginBottom: responsiveSize.lg,            // ~24px
    marginTop: responsiveSize.md,               // ~12px
  },
});
```

**Available sizes:**
- `xs` - Extra small (4px)
- `sm` - Small (8px)
- `md` - Medium (12px)
- `base` - Standard (16px)
- `lg` - Large (24px)
- `xl` - Extra large (32px)
- `xxl` - Double extra large (48px)

### 3. Responsive Font Sizes

Use `fontSize` for all text:

```javascript
const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.h1,      // ~32px
    fontWeight: '800',
  },
  subtitle: {
    fontSize: fontSize.h2,      // ~28px
  },
  body: {
    fontSize: fontSize.body,    // ~14px
  },
});
```

**Available sizes:**
- `h1` - Heading 1 (~32px)
- `h2` - Heading 2 (~28px)
- `h3` - Heading 3 (~24px)
- `h4` - Heading 4 (~20px)
- `h5` - Heading 5 (~18px)
- `h6` - Heading 6 (~16px)
- `body` - Body text (~14px)
- `small` - Small text (~12px)
- `tiny` - Tiny text (~10px)

### 4. Responsive Component Dimensions

#### Input Fields
```javascript
import { inputDimensions } from '../utils/responsive';

const styles = StyleSheet.create({
  input: {
    height: inputDimensions.height,
    paddingHorizontal: inputDimensions.paddingHorizontal,
    paddingVertical: inputDimensions.paddingVertical,
    borderRadius: inputDimensions.borderRadius,
  },
});
```

#### Buttons
```javascript
import { buttonDimensions } from '../utils/responsive';

const styles = StyleSheet.create({
  button: {
    height: buttonDimensions.height,
    paddingVertical: buttonDimensions.paddingVertical,
    paddingHorizontal: buttonDimensions.paddingHorizontal,
  },
});
```

#### Images
```javascript
import { imageDimensions } from '../utils/responsive';

const styles = StyleSheet.create({
  avatar: {
    width: imageDimensions.avatarMedium,    // ~56px
    height: imageDimensions.avatarMedium,
  },
  icon: {
    width: imageDimensions.iconMedium,      // ~24px
    height: imageDimensions.iconMedium,
  },
});
```

### 5. Conditional Rendering Based on Device

```javascript
import { isTablet, isPhone } from '../utils/responsive';

// In your component
export const MyScreen = () => {
  return (
    <View>
      {isPhone() && <MobileLayout />}
      {isTablet() && <TabletLayout />}
    </View>
  );
};

// Or use maxWidth based on device
const styles = StyleSheet.create({
  container: {
    maxWidth: isTablet() ? 500 : 350,
  },
});
```

### 6. Using Pre-built Responsive Components

```javascript
import { 
  ResponsiveGrid,
  ResponsiveContainer,
  ResponsiveCard,
  ResponsiveFlex
} from '../components/ResponsiveComponents';

// Responsive grid that adjusts columns
<ResponsiveGrid spacing={responsiveSize.md}>
  <Card1 />
  <Card2 />
  <Card3 />
</ResponsiveGrid>

// Responsive container with automatic padding
<ResponsiveContainer spacing={responsiveSize.base}>
  <Text>Content automatically padded</Text>
</ResponsiveContainer>

// Responsive card
<ResponsiveCard padding={responsiveSize.base}>
  <Text>Card content</Text>
</ResponsiveCard>

// Responsive flex (changes direction on tablet)
<ResponsiveFlex direction="column" spacing={responsiveSize.md}>
  <Item1 />
  <Item2 />
</ResponsiveFlex>
```

---

## Scaling Functions

For advanced use cases, use scaling functions:

```javascript
import { 
  scale,           // Full screen width scaling
  verticalScale,   // Screen height scaling
  moderateScale    // Balanced scaling (recommended)
} from '../utils/responsive';

const styles = StyleSheet.create({
  container: {
    padding: moderateScale(16),  // Scales with factor of 0.5
    marginTop: scale(20),        // Full scaling
    height: verticalScale(300),  // Height-based scaling
  },
});
```

### Scaling Factors
- `scale()` - Scales 100% with screen width changes
- `verticalScale()` - Scales 100% with screen height changes
- `moderateScale(size, factor)` - Default factor is 0.5
  - Factor 0 = No scaling
  - Factor 0.5 = Half scaling (recommended)
  - Factor 1 = Full scaling

---

## Device Detection

```javascript
import { getDeviceType, isPhone, isTablet, isPortrait } from '../utils/responsive';

const deviceType = getDeviceType();
// Returns: 'small', 'medium', 'large', 'extraLarge', 'tablet', 'desktop'

if (isPhone()) {
  // Render mobile layout
}

if (isTablet()) {
  // Render tablet layout
}

if (isPortrait()) {
  // Render portrait layout
}
```

---

## Migration Guide

### Before (Hard-coded values)
```javascript
const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  input: {
    height: 56,
    paddingHorizontal: 18,
  },
});
```

### After (Responsive)
```javascript
import { responsiveSize, fontSize, inputDimensions } from '../utils/responsive';

const styles = StyleSheet.create({
  container: {
    padding: responsiveSize.base,
    marginBottom: responsiveSize.lg,
  },
  title: {
    fontSize: fontSize.h2,
    fontWeight: '800',
  },
  input: {
    height: inputDimensions.height,
    paddingHorizontal: inputDimensions.paddingHorizontal,
  },
});
```

---

## Best Practices

### ✅ DO

1. **Always use responsive utilities** instead of hard-coded values
   ```javascript
   ✓ padding: responsiveSize.base
   ✗ padding: 16
   ```

2. **Use `moderateScale` for balanced scaling**
   ```javascript
   ✓ marginBottom: responsiveSize.lg
   ✓ padding: moderateScale(20)
   ✗ margin: 20  // Hard-coded
   ```

3. **Use pre-built dimension objects** for common elements
   ```javascript
   ✓ height: inputDimensions.height
   ✗ height: 56
   ```

4. **Check device type for major layout changes**
   ```javascript
   ✓ maxWidth: isTablet() ? 600 : 350
   ✗ maxWidth: 350  // Always same
   ```

5. **Test on multiple devices** - Small phone, medium phone, tablet

### ❌ DON'T

1. **Don't hard-code sizes**
   ```javascript
   ✗ padding: 16
   ✗ fontSize: 14
   ```

2. **Don't create multiple layout files**
   ```javascript
   ✗ LoginScreen.js, LoginScreen.tablet.js
   ✓ Single file with responsive design
   ```

3. **Don't use Dimensions directly**
   ```javascript
   ✗ const width = Dimensions.get('window').width
   ✓ import { SCREEN_WIDTH } from '../utils/responsive'
   ```

4. **Don't ignore tablet layouts**
   ```javascript
   ✗ Same layout for all devices
   ✓ Optimize for phone, tablet, desktop
   ```

---

## Common Patterns

### Full-Width Container
```javascript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: responsiveSize.base,
  },
});
```

### Centered Content with Max Width
```javascript
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: responsiveSize.base,
  },
  content: {
    width: '100%',
    maxWidth: isTablet() ? 600 : 350,
  },
});
```

### Responsive Grid
```javascript
<ResponsiveGrid spacing={responsiveSize.md} numColumns={isTablet() ? 2 : 1}>
  {items.map(item => <Card key={item.id} {...item} />)}
</ResponsiveGrid>
```

### Responsive Button
```javascript
<Pressable style={[
  styles.button,
  { paddingVertical: buttonDimensions.paddingVertical }
]}>
  <Text style={{ fontSize: fontSize.body }}>Press Me</Text>
</Pressable>
```

---

## Testing

### Test Devices
- ✅ iPhone SE (320px) - Small
- ✅ iPhone 12 (375px) - Medium
- ✅ iPhone 14 Plus (414px) - Large
- ✅ iPad Mini (768px) - Tablet
- ✅ iPad Pro (1024px) - Large Tablet

### Validation Checklist
- [ ] Text is readable on small phones
- [ ] Images scale properly
- [ ] Spacing looks consistent
- [ ] Buttons are easy to tap (50px minimum)
- [ ] No text overflow
- [ ] Portrait and landscape work
- [ ] Tablets use space efficiently

---

## Performance Notes

✅ **Lightweight** - Responsive utilities are computed once on app load
✅ **No Re-renders** - Static values, no animation dependencies
✅ **Efficient** - Uses React Native's built-in scaling
✅ **Maintainable** - Single source of truth for all sizes

---

## Summary

The MindSentry app now automatically scales all UI elements based on screen size. Every screen, component, and style uses responsive utilities to ensure perfect appearance on any device from small phones to tablets.

All developers should use the responsive utilities for:
- Spacing (`responsiveSize`)
- Font sizes (`fontSize`)
- Component dimensions (`inputDimensions`, `buttonDimensions`, `imageDimensions`)
- Conditional rendering (`isPhone()`, `isTablet()`, `getDeviceType()`)

This ensures consistency and maintainability across the entire codebase.
