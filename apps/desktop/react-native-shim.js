export const Platform = { OS: 'web' };
export const StyleSheet = { create: (s) => s };
export const View = () => null;
export const Text = () => null;
export const ScrollView = () => null;
export const Keyboard = { dismiss: () => {} };
export const Linking = { openURL: () => Promise.resolve() };
export const useWindowDimensions = () => ({ width: 1000, height: 1000 });
export default { Platform, StyleSheet, View, Text, ScrollView, Keyboard, Linking, useWindowDimensions };
