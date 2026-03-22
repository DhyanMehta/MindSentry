import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';

export const ErrorBox = ({ message, onDismiss, style }) => {
    if (!message) return null;

    return (
        <View style={[styles.container, style]}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} style={styles.icon} />
            <Text style={styles.message}>{message}</Text>
            {onDismiss ? (
                <Pressable onPress={onDismiss} style={styles.closeButton}>
                    <Ionicons name="close" size={16} color={colors.danger} />
                </Pressable>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
    },
    icon: {
        marginRight: 8,
        alignSelf: 'flex-start',
        marginTop: 1,
    },
    message: {
        flex: 1,
        color: '#991B1B',
        fontSize: 13,
        lineHeight: 18,
    },
    closeButton: {
        marginLeft: 8,
        padding: 2,
    },
});
