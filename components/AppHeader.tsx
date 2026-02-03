import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AppHeader({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, backgroundColor: '#0ea5a2' },
  title: { color: '#fff', fontSize: 20, fontWeight: '600' }
});
