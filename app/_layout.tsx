import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RootLayout() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>GoGoCar 🚗</Text>
      <Text style={styles.sub}>Loading OK!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  sub: {
    fontSize: 16,
    color: '#fff',
    marginTop: 8,
  },
});
