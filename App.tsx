import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import WalletScreen from 'screens/WalletScreen';
import MapsScreen from 'screens/MapsScreen';
import CalendrierScreen from 'screens/CalendrierScreen';
import ForgotPassScreen from 'screens/ForgotPass';
import MoncompteScreen from 'screens/Moncompte';
const Stack = createNativeStackNavigator();
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Wallet" component={WalletScreen} />
          <Stack.Screen name="Maps" component={MapsScreen} />
          <Stack.Screen name="Calendrier" component={CalendrierScreen} />
          <Stack.Screen name="PassRec" component={ForgotPassScreen} />
          <Stack.Screen name="moncompte" component={MoncompteScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
