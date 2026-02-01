import { useAppTheme } from '@/hooks/use-app-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

interface SearchOverlayProps {
    visible: boolean;
    onClose: () => void;
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
    resultCount: number;
    currentResultIndex: number;
    onNext: () => void;
    onPrev: () => void;
}

export function SearchOverlay({
    visible,
    onClose,
    searchTerm,
    onSearchTermChange,
    resultCount,
    currentResultIndex,
    onNext,
    onPrev,
}: SearchOverlayProps) {
    const { colors } = useAppTheme();
    const inputRef = useRef<TextInput>(null);
    const translateY = useRef(new Animated.Value(-60)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 12,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                // Focus the input after animation
                inputRef.current?.focus();
            });
        } else {
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: -60,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible, translateY, opacity]);

    if (!visible) return null;

    const hasResults = resultCount > 0;
    const resultText = hasResults
        ? `${currentResultIndex + 1} of ${resultCount}`
        : searchTerm.length > 0
            ? '0 results'
            : '';

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: colors.card,
                    borderBottomColor: colors.border,
                    transform: [{ translateY }],
                    opacity,
                },
            ]}
        >
            <View style={styles.content}>
                {/* Search Input */}
                <View
                    style={[
                        styles.inputContainer,
                        { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                >
                    <Ionicons name="search" size={18} color={colors.text + '60'} />
                    <TextInput
                        ref={inputRef}
                        style={[styles.input, { color: colors.text }]}
                        value={searchTerm}
                        onChangeText={onSearchTermChange}
                        placeholder="Search in note..."
                        placeholderTextColor={colors.text + '60'}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                    />
                    {searchTerm.length > 0 && (
                        <Pressable
                            onPress={() => onSearchTermChange('')}
                            hitSlop={8}
                            style={styles.clearButton}
                        >
                            <Ionicons name="close-circle" size={18} color={colors.text + '60'} />
                        </Pressable>
                    )}
                </View>

                {/* Results Counter */}
                <Text style={[styles.resultText, { color: colors.text + '80' }]}>
                    {resultText}
                </Text>

                {/* Navigation Arrows */}
                <View style={styles.navButtons}>
                    <Pressable
                        onPress={onPrev}
                        disabled={!hasResults}
                        style={({ pressed }) => [
                            styles.navButton,
                            !hasResults && styles.navButtonDisabled,
                            pressed && hasResults && { opacity: 0.7 },
                        ]}
                        hitSlop={8}
                    >
                        <Ionicons
                            name="chevron-up"
                            size={22}
                            color={hasResults ? colors.primary : colors.text + '30'}
                        />
                    </Pressable>
                    <Pressable
                        onPress={onNext}
                        disabled={!hasResults}
                        style={({ pressed }) => [
                            styles.navButton,
                            !hasResults && styles.navButtonDisabled,
                            pressed && hasResults && { opacity: 0.7 },
                        ]}
                        hitSlop={8}
                    >
                        <Ionicons
                            name="chevron-down"
                            size={22}
                            color={hasResults ? colors.primary : colors.text + '30'}
                        />
                    </Pressable>
                </View>

                {/* Close Button */}
                <Pressable
                    onPress={onClose}
                    style={({ pressed }) => [
                        styles.closeButton,
                        pressed && { opacity: 0.7 },
                    ]}
                    hitSlop={8}
                >
                    <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        borderBottomWidth: 1,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    inputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 36,
        borderWidth: 1,
        gap: 8,
    },
    input: {
        flex: 1,
        fontSize: 15,
        padding: 0,
    },
    clearButton: {
        padding: 2,
    },
    resultText: {
        fontSize: 13,
        fontWeight: '500',
        minWidth: 60,
        textAlign: 'center',
    },
    navButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    navButton: {
        padding: 4,
    },
    navButtonDisabled: {
        opacity: 0.4,
    },
    closeButton: {
        padding: 4,
    },
});
