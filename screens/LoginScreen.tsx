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
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';

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
          });
        }

        console.log('📍 Location updated:', latitude, longitude);
      }
    );
  };

  // ================== LOGIN ==================
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Remplis tous les champs');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    setLoading(false);

    if (error || !data) {
      Alert.alert('Login échoué', 'Email ou mot de passe incorrect');
      return;
    }

    Alert.alert('Bienvenue', `Bonjour ${data.nom}`);
    console.log('User connecté :', data);

    try {
      await AsyncStorage.setItem('userData', JSON.stringify(data));
    } catch (e) {
      console.error('AsyncStorage error:', e);
    }

    // 🔥 START LIVE LOCATION
    await startLiveLocation(data.id);

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
});
