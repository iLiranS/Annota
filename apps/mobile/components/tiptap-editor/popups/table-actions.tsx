import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@react-navigation/native';
import React, { ComponentProps, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLOR_PALETTE } from '@annota/core/constants/colors';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

interface TableActionButtonProps {
    icon: MaterialIconName;
    label: string;
    onPress: () => void;
    disabled?: boolean;
    destructive?: boolean;
}

function TableActionButton({ icon, label, onPress, disabled, destructive }: TableActionButtonProps) {
    const { colors, dark } = useTheme();

    const getColor = () => {
        if (disabled) return dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
        if (destructive) return '#FF453A';
        return colors.text;
    };

    return (
        <Pressable
            style={[styles.tableActionButton, disabled && styles.tableActionButtonDisabled]}
            onPress={onPress}
            disabled={disabled}
        >
            <MaterialIcons name={icon} size={20} color={getColor()} />
            <Text style={[styles.tableActionLabel, { color: getColor() }]}>{label}</Text>
        </Pressable>
    );
}

interface TableActionsProps {
    canAddRowBefore: boolean;
    canAddRowAfter: boolean;
    canAddColumnBefore: boolean;
    canAddColumnAfter: boolean;
    canDeleteRow: boolean;
    canDeleteColumn: boolean;
    canDeleteTable: boolean;
    onCommand: (command: string, params?: Record<string, unknown>) => void;
    onClose: () => void;
}

export function TableActions({
    canAddRowBefore,
    canAddRowAfter,
    canAddColumnBefore,
    canAddColumnAfter,
    canDeleteRow,
    canDeleteColumn,
    canDeleteTable,
    onCommand,
    onClose,
}: TableActionsProps) {
    const { colors, dark } = useTheme();
    const [selectedBgColor, setSelectedBgColor] = useState<string | null>(null);

    const handleCommand = (command: string, params?: Record<string, unknown>) => {
        onCommand(command, params);
        onClose();
    };

    const handleCellBackground = (color: string) => {
        setSelectedBgColor(color);
        onCommand('setCellBackground', { color });
        onClose();
    };

    const handleClearCellBackground = () => {
        setSelectedBgColor(null);
        onCommand('unsetCellBackground');
        onClose();
    };

    return (
        <View style={styles.popupContent}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Table Options</Text>

            {/* Cell Background Section */}
            <View style={styles.tableSection}>
                <Text style={[styles.tableSectionTitle, { color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>
                    Cell Background
                </Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.colorGrid}
                >
                    {COLOR_PALETTE.map((colorOption) => {
                        const colorValue = colorOption.value;
                        const isSelected = selectedBgColor === colorValue;
                        return (
                            <Pressable
                                key={colorValue}
                                style={[
                                    styles.colorItem,
                                    { backgroundColor: colorValue },
                                    isSelected && styles.colorItemSelected,
                                ]}
                                onPress={() => handleCellBackground(colorValue)}
                            >
                                {isSelected && (
                                    <MaterialIcons name="check" size={18} color="#FFFFFF" />
                                )}
                            </Pressable>
                        );
                    })}
                    <Pressable
                        style={[styles.colorItem, styles.colorItemClear]}
                        onPress={handleClearCellBackground}
                        hitSlop={8}
                    >
                        <MaterialIcons name="format-color-reset" size={18} color={dark ? '#fff' : '#000'} />
                    </Pressable>
                </ScrollView>
            </View>

            {/* Row Section */}
            <View style={styles.tableSection}>
                <Text style={[styles.tableSectionTitle, { color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>
                    Rows
                </Text>
                <View style={styles.tableActionsRow}>
                    <TableActionButton
                        icon="add"
                        label="Add Above"
                        onPress={() => handleCommand('addRowBefore')}
                        disabled={!canAddRowBefore}
                    />
                    <TableActionButton
                        icon="add"
                        label="Add Below"
                        onPress={() => handleCommand('addRowAfter')}
                        disabled={!canAddRowAfter}
                    />
                    <TableActionButton
                        icon="remove"
                        label="Delete"
                        onPress={() => handleCommand('deleteRow')}
                        disabled={!canDeleteRow}
                        destructive
                    />
                </View>
            </View>

            {/* Column Section */}
            <View style={styles.tableSection}>
                <Text style={[styles.tableSectionTitle, { color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>
                    Columns
                </Text>
                <View style={styles.tableActionsRow}>
                    <TableActionButton
                        icon="add"
                        label="Add Left"
                        onPress={() => handleCommand('addColumnBefore')}
                        disabled={!canAddColumnBefore}
                    />
                    <TableActionButton
                        icon="add"
                        label="Add Right"
                        onPress={() => handleCommand('addColumnAfter')}
                        disabled={!canAddColumnAfter}
                    />
                    <TableActionButton
                        icon="remove"
                        label="Delete"
                        onPress={() => handleCommand('deleteColumn')}
                        disabled={!canDeleteColumn}
                        destructive
                    />
                </View>
            </View>

            {/* Delete Table */}
            <Pressable
                style={[styles.deleteTableButton, !canDeleteTable && styles.tableActionButtonDisabled]}
                onPress={() => handleCommand('deleteTable')}
                disabled={!canDeleteTable}
            >
                <MaterialIcons name="delete-outline" size={20} color={canDeleteTable ? '#FF453A' : 'rgba(128,128,128,0.5)'} />
                <Text style={[styles.deleteTableText, !canDeleteTable && { color: 'rgba(128,128,128,0.5)' }]}>Delete Table</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    popupContent: {
        gap: 12,
    },
    popupTitle: {
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 4,
    },
    // Table popup styles
    tableSection: {
        gap: 8,
    },
    tableSectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    tableActionsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    tableActionButton: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(128,128,128,0.1)',
        gap: 4,
    },
    tableActionButtonDisabled: {
        opacity: 0.5,
    },
    tableActionLabel: {
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
    },
    deleteTableButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(255,69,58,0.1)',
        marginTop: 4,
    },
    deleteTableText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#FF453A',
    },
    colorGrid: {
        flexDirection: 'row',
        paddingRight: 20,
    },
    colorItem: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    colorItemSelected: {
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    colorItemClear: {
        backgroundColor: 'rgba(128,128,128,0.2)',
    },
});
