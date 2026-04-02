import { useAppTheme as useLocalTheme } from "@/hooks/use-app-theme";
import { useChangelog } from "@annota/core";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import ThemedText from "./themed-text";

interface Props {
  isScreen?: boolean;
  onClose?: () => void;
}

export default function ChangelogModalContent({ isScreen, onClose }: Props) {
  const { changelogData, markAsSeen, openManual } = useChangelog("mobile");
  const { colors, dark } = useLocalTheme();

  React.useEffect(() => {
    if (isScreen && !changelogData) {
      openManual();
    }
  }, [isScreen, changelogData]);

  if (!changelogData && !isScreen) return null;
  if (isScreen && !changelogData) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const handleDone = () => {
    markAsSeen();
    if (onClose) onClose();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 0, backgroundColor: colors.background }} />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText style={styles.title}>
          {changelogData!.title}
        </ThemedText>
        <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
          <ThemedText style={[styles.badgeText, { color: colors.primary }]}>{changelogData!.date}</ThemedText>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {changelogData!.features.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="sparkles" size={20} color={colors.primary} />
              <ThemedText style={styles.sectionTitle}>What's New</ThemedText>
            </View>
            {changelogData!.features.map((feature, i) => (
              <View key={i} style={styles.listItem}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <ThemedText style={styles.listText}>{feature}</ThemedText>
              </View>
            ))}
          </View>
        )}

        {changelogData!.fixes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bug" size={20} color={colors.text + '60'} />
              <ThemedText style={[styles.sectionTitle, { color: colors.text + '80' }]}>Improvements</ThemedText>
            </View>
            {changelogData!.fixes.map((fix, i) => (
              <View key={i} style={styles.listItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary + '40'} />
                <ThemedText style={[styles.listText, { color: colors.text + '70' }]}>{fix}</ThemedText>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.button, { backgroundColor: colors.primary, shadowColor: dark ? '#000' : colors.primary }]}
          onPress={handleDone}
        >
          <ThemedText style={styles.buttonText}>Awesome</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  listItem: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  listText: {
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
    fontWeight: '400',
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  button: {
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
