import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  ImageBackground,
  Alert,
} from 'react-native';
import { supabase } from '../src/lib/supabase';
import { API_BASE_URL } from '../src/lib/api';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
};

let locationSubscription: Location.LocationSubscription | null = null;

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // ================== LIVE LOCATION ==================
  const startLiveLocation = async (userId: number) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Erreur', 'Permission de localisation refusée');
      return;
    }

    const { data: existing } = await supabase
      .from('locations')
      .select('id')
      .eq('employee_id', userId)
      .single();

    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 2,
      },
      async (location) => {
        const { latitude, longitude } = location.coords;

        if (existing) {
          await supabase
            .from('locations')
            .update({
              location_lat: latitude,
              location_lng: longitude,
              updated_at: new Date(),
            })
            .eq('employee_id', userId);
        } else {
          await supabase.from('locations').insert({
            employee_id: userId,
            location_lat: latitude,
            location_lng: longitude,
            updated_at: new Date(),
          });
        }

        console.log('📍 Location updated:', latitude, longitude);
      }
    );
  };

  // Charger les identifiants mémorisés
  useEffect(() => {
    // Si l'utilisateur est déjà connecté, passer l'écran de login
    const checkExistingSession = async () => {
      try {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          navigation.navigate('Home');
          return;
        }
      } catch {}
    };
    checkExistingSession();

    const loadSavedCredentials = async () => {
      try {
        const remember = await AsyncStorage.getItem('rememberMe');
        const savedEmail = await AsyncStorage.getItem('savedEmail');
        const savedPassword = await AsyncStorage.getItem('savedPassword');
        const rememberFlag = remember === 'true';
        setRememberMe(rememberFlag);
        if (rememberFlag) {
          if (savedEmail) setEmail(savedEmail);
          if (savedPassword) setPassword(savedPassword);
        }
      } catch (e) {
        // ignore
      }
    };
    loadSavedCredentials();
  }, []);

  // ================== LOGIN ==================
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Remplis tous les champs');
      return;
    }

    setLoading(true);
    let data: any = null;
    let error: any = null;

    try {
      if (API_BASE_URL) {
        const res = await fetch(`${API_BASE_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          error = await res.json().catch(() => ({ message: 'Login error' }));
        } else {
          const json = await res.json();
          data = json.user || json;
        }
      } else {
        const r = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .eq('password', password)
          .single();
        data = r.data;
        error = r.error;
      }
    } catch (e) {
      error = e;
    } finally {
      setLoading(false);
    }

    if (error || !data) {
      Alert.alert('Login échoué', 'Email ou mot de passe incorrect');
      return;
    }

    Alert.alert('Bienvenue', `Bonjour ${data.nom}`);
    console.log('User connecté :', data);

    try {
      await AsyncStorage.setItem('userData', JSON.stringify(data));
      // Mémoriser identifiants si demandé
      if (rememberMe) {
        await AsyncStorage.setItem('rememberMe', 'true');
        await AsyncStorage.setItem('savedEmail', email);
        await AsyncStorage.setItem('savedPassword', password);
      } else {
        await AsyncStorage.setItem('rememberMe', 'false');
        await AsyncStorage.removeItem('savedEmail');
        await AsyncStorage.removeItem('savedPassword');
      }
    } catch (e) {
      console.error('AsyncStorage error:', e);
    }

    // 🔥 START LIVE LOCATION
    await startLiveLocation(data.id);

    // 🔔 Register push token for notifications
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        if (req.status !== 'granted') {
          console.log('Notifications permission not granted');
        }
      }
      // Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      if (token?.data) {
        await supabase
          .from('push_tokens')
          .upsert({ user_id: data.id, token: token.data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,token' });
        console.log('Expo push token registered:', token.data);
      }
    } catch (e) {
      console.error('Push token registration failed:', e);
    }

    navigation.navigate('Home');
  };
  return (
    <ImageBackground
      source={require('../assets/bglogin.jpg')}
      style={styles.container}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.screen}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appTitle}>NovaEcoClean</Text>
            <Text style={styles.appSubtitle}>Solutions de nettoyage écologique</Text>
          </View>

          <View style={styles.welcome}>
            <Text style={styles.welcomeTitle}>Bienvenue !</Text>
            <Text style={styles.welcomeSub}>
              Connectez-vous pour accéder à votre espace
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Adresse email</Text>
            <View style={styles.inputRow}>
              <MaterialIcons name="mail-outline" size={20} color="white" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="exemple@gmail.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                style={styles.input}
              />
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Mot de passe</Text>
            <View style={styles.inputRow}>
              <MaterialIcons name="lock-outline" size={20} color="white" />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPassword}
                style={[styles.input, { paddingRight: 44 }]}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={20}
                  color="white"
                />
              </TouchableOpacity>
            </View>

            {/* Se souvenir de moi */}
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <MaterialIcons
                name={rememberMe ? 'check-box' : 'check-box-outline-blank'}
                size={20}
                color={'white'}
              />
              <Text style={styles.rememberText}>Se souvenir de moi</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#064e3b" />
              ) : (
                <Text style={styles.loginButtonText}>Se connecter</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2026 NovaEcoClean — Powered by{' '}
            <Text style={styles.footerBrand}>ZelvIT</Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screen: { flex: 1 },
  content: { paddingTop: 80, paddingHorizontal: 20, paddingBottom: 24 },
  logoSection: { alignItems: 'center', marginTop: 118 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: { width: 100, height: 100 },
  appTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  appSubtitle: { fontSize: 12, color: '#6b7280' },
  welcomeTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  welcomeSub: { fontSize: 13, color: '#6b7280' },
  form: { marginTop: 8 },
  label: { fontSize: 13, color: 'white', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 8,
  },
  input: { flex: 1, color: 'white', marginLeft: 6 },
  eyeButton: { position: 'absolute', right: 8 },
  loginButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  footer: { alignItems: 'center', paddingBottom: 10 },
  footerText: { fontSize: 11, color: 'white' },
  footerBrand: { fontWeight: '700', color: 'black' },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  rememberText: { color: 'white', fontSize: 13 },
});
