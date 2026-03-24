import { useState, useEffect, useCallback } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { ENABLE_REVENUECAT } from '../services/RevenueCat';

const ENTITLEMENT_ID = 'Annota Pro';

export function useRevenueCat() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isPro, setIsPro] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkEntitlements = useCallback(async () => {
    if (!ENABLE_REVENUECAT || !Purchases) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      const isUserPro = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
      setIsPro(isUserPro);
    } catch (e) {
      console.error('Error fetching RevenueCat customer info', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ENABLE_REVENUECAT || !Purchases) {
      setIsLoading(false);
      return;
    }

    checkEntitlements();

    // Listen for customer info updates (e.g. after a purchase or restore)
    const listener = (info: CustomerInfo) => {
      setCustomerInfo(info);
      const isUserPro = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
      setIsPro(isUserPro);
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    // The react-native-purchases library doesn't strictly require listener removal 
    // for this global event, but if it did, there's no return value for unsubscription 
    // in current versions of addCustomerInfoUpdateListener.
  }, [checkEntitlements]);

  return {
    customerInfo,
    isPro,
    isLoading,
    checkEntitlements,
  };
}
