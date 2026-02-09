import React, { useEffect, useRef, useState } from 'react';
import { Platform, View, Text } from 'react-native';
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
import { supabase } from './src/lib/supabase';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
const Stack = createNativeStackNavigator();
export default function App() {
    // Global notifications handler to show alerts in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        // Ensure banner/list presentation on platforms that support it
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Ensure permission and Android channel at startup
    useEffect(() => {
      const setupNotifications = async () => {
        try {
          const { status } = await Notifications.getPermissionsAsync();
          if (status !== 'granted') {
            await Notifications.requestPermissionsAsync();
          }
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'default',
              importance: Notifications.AndroidImportance.HIGH,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#FF231F7C',
            });
          }
        } catch (err) {
          console.error('Notification setup error:', err);
        }
      };
      setupNotifications();
    }, []);
  const [userId, setUserId] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const notifSubRef = useRef<any>(null);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const parsed = JSON.parse(userData);
          setUserId(String(parsed.id));
        }
      } catch {}

      // Foreground pop-up for new tasks
      const subscribeRealtime = () => {
        try {
          channelRef.current = supabase
            .channel('tasks-foreground-global')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, async (payload: any) => {
              try {
                const task = payload?.new || {};
                if (!task.assigned_to || !userId) return;
                if (String(task.assigned_to) !== String(userId)) return;
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: 'Nouvelle tâche',
                    body: 'Consultez votre calendrier',
                    sound: true,
                  },
                  trigger: null,
                });
              } catch (err) {
                console.error('Foreground notify error:', err);
              }
            })
            .subscribe((status: any) => {
              console.log('📡 Global realtime status:', status);
              if (status === 'CLOSED' || status === 'TIMED_OUT') {
                // retry subscribe after short delay
                setTimeout(() => {
                  try { if (channelRef.current) supabase.removeChannel(channelRef.current); } catch {}
                  subscribeRealtime();
                }, 2000);
              }
            });
        } catch (err) {
          console.error('Realtime init error:', err);
        }
      };
      subscribeRealtime();
      
      try {
        // no-op, handled above
      } catch (err) {
        console.error('Realtime init error:', err);
      }
    };
    init();

    return () => {
      try { if (channelRef.current) supabase.removeChannel(channelRef.current); } catch {}
    };
  }, [userId]);
  
  useEffect(() => {
    // In-app toast fallback for foreground notifications
    try {
      notifSubRef.current = Notifications.addNotificationReceivedListener((notification) => {
        const title = notification.request.content.title || 'Notification';
        const body = notification.request.content.body || '';
        setToast({ title, body });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 4000);
      });
    } catch (err) {
      console.error('Add notification listener error:', err);
    }

    return () => {
      try { if (notifSubRef.current) notifSubRef.current.remove(); } catch {}
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);
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
      {toast && (
        <View style={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 9999 }}>
          <View style={{ backgroundColor: '#10b981', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{toast.title}</Text>
            {toast.body ? <Text style={{ color: '#f0fdf4', marginTop: 2 }}>{toast.body}</Text> : null}
          </View>
        </View>
      )}
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
