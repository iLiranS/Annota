import { useEffect } from 'react';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || '';
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || '';

/**
 * Flag to easily enable/disable RevenueCat across the app.
 * Set to false to disable RevenueCat (e.g. for testing without production API keys).
 */
export const ENABLE_REVENUECAT = false;

export const useRevenueCatInitialization = () => {
  useEffect(() => {
    // Return early if RevenueCat is disabled
    if (!ENABLE_REVENUECAT) return;

    // RevenueCat is not supported on Web
    if (Platform.OS === 'web') return;
    
    // Safety check: ensure Purchases is actually available 
    // (This can be null if native modules are not linked or in Expo Go)
    if (!Purchases) {
        console.warn('RevenueCat: Purchases SDK is not available in this environment.');
        return;
    }

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.INFO);
    }

    try {
      if (Platform.OS === 'ios' && IOS_API_KEY) {
        Purchases.configure({ apiKey: IOS_API_KEY });
      } else if (Platform.OS === 'android' && ANDROID_API_KEY) {
        Purchases.configure({ apiKey: ANDROID_API_KEY });
      }
    } catch (err) {
      console.warn('RevenueCat: configuration failed', err);
    }
  }, []);
};

/**
 * Identify user in RevenueCat
 */
export const logInRevenueCat = async (userId: string) => {
  if (!ENABLE_REVENUECAT || Platform.OS === 'web' || !Purchases) return;
  try {
    await Purchases.logIn(userId);
  } catch (err) {
    console.warn('RevenueCat: logIn failed', err);
  }
};

/**
 * Log out user from RevenueCat
 */
export const logOutRevenueCat = async () => {
  if (!ENABLE_REVENUECAT || Platform.OS === 'web' || !Purchases) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    console.warn('RevenueCat: logOut failed', err);
  }
};

/**
 * RevenueCat Initializer Component
 * Render this in your root layout to initialize RevenueCat.
 */
export default function RevenueCatInitializer() {
  useRevenueCatInitialization();
  return null;
}
