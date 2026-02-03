import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
};

const currentUser = { name: 'Issam', email: 'issam@example.com', password: '123456' };

export default function MoncompteScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Etats pour le formulaire
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [password, setPassword] = useState(currentUser.password);

  const handleSave = () => {
    // Ici tu pourrais appeler ton API pour mettre à jour les infos
    Alert.alert('Succès', 'Vos informations ont été mises à jour !');
    console.log({ name, email, password });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <Text style={styles.welcomeText}>Bienvenue, {currentUser.name}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <MaterialCommunityIcons name="logout" size={24} color="#059669" />
        </TouchableOpacity>
      </View>

      {/* FORMULAIRE */}
      <View style={styles.form}>
        <Text style={styles.label}>Nom</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Votre nom"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Votre email"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Votre mot de passe"
          secureTextEntry
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Enregistrer les modifications</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  welcomeText: { fontSize: 18, fontWeight: '700', color: '#0f172a' },

  form: { paddingHorizontal: 18, paddingTop: 24 },
  label: { fontSize: 14, color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 16,
    color: '#111827',
  },

  saveBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
