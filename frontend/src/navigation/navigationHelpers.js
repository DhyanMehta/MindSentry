export const navigateToMainTab = (navigation, screen) =>
  navigation.navigate('MainTabs', { screen });

export const navigateToDashboard = (navigation) =>
  navigateToMainTab(navigation, 'Dashboard');
