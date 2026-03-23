import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

export default function PaywallScreen() {
    const router = useRouter();

    const handlePaywallResult = (result: PAYWALL_RESULT) => {
        switch (result) {
            case PAYWALL_RESULT.PURCHASED:
            case PAYWALL_RESULT.RESTORED:
                // Successfully purchased or restored Annota Pro
                Toast.show({
                    type: 'success',
                    text1: 'Purchase Successful',
                    text2: 'Please wait a few minutes and restart the app for changes to take effect.',
                    visibilityTime: 6000,
                });
                router.back();
                break;
            case PAYWALL_RESULT.CANCELLED:
            case PAYWALL_RESULT.ERROR:
            case PAYWALL_RESULT.NOT_PRESENTED:
            default:
                // User dismissed or something failed
                router.dismiss();
                break;
        }
    };

    if (!RevenueCatUI || !RevenueCatUI.Paywall) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                <Text style={{ textAlign: 'center' }}>
                    The subscription system is not available in the current environment or a native build is required.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <RevenueCatUI.Paywall 
                onDismiss={() => {
                    router.dismiss();
                }}
                onPurchaseCompleted={({ customerInfo }) => {
                    handlePaywallResult(PAYWALL_RESULT.PURCHASED);
                }}
                onRestoreCompleted={({ customerInfo }) => {
                    handlePaywallResult(PAYWALL_RESULT.RESTORED);
                }}
                onPurchaseCancelled={() => {
                    handlePaywallResult(PAYWALL_RESULT.CANCELLED);
                }}
                onPurchaseError={(error) => {
                    handlePaywallResult(PAYWALL_RESULT.ERROR);
                }}
                onRestoreError={(error) => {
                    handlePaywallResult(PAYWALL_RESULT.ERROR);
                }}
            />
        </View>
    );
}

/**
 * Helper function to present the paywall as a modal imperatively.
 */
export async function presentPaywall(): Promise<boolean> {
    if (!RevenueCatUI || !RevenueCatUI.presentPaywall) return false;
    const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();
    
    switch (paywallResult) {
        case PAYWALL_RESULT.NOT_PRESENTED:
        case PAYWALL_RESULT.ERROR:
        case PAYWALL_RESULT.CANCELLED:
            return false;
        case PAYWALL_RESULT.PURCHASED:
        case PAYWALL_RESULT.RESTORED:
            Toast.show({
                type: 'success',
                text1: 'Purchase Successful',
                text2: 'Please wait a few minutes and restart the app for changes to take effect.',
                visibilityTime: 6000,
            });
            return true;
        default:
            return false;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
