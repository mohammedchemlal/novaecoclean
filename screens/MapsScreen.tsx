import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
};

// Supposons que c'est ton utilisateur connecté
const currentUser = { name: 'Issam' };

const clients = [
  { id: 1, name: 'Client A', address: 'Rue 1', status: 'En attente', avatar: 'A', lat: 48.85, lng: 2.35 },
  { id: 2, name: 'Client B', address: 'Rue 2', status: 'Terminé', avatar: 'B', lat: 48.86, lng: 2.36 },
  { id: 3, name: 'Client C', address: 'Rue 3', status: 'En cours', avatar: 'C', lat: 48.87, lng: 2.37 },
];

export default function MapsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedClient, setSelectedClient] = useState(clients[0]);

  return (
    <View style={styles.container}>
      <View style={styles.screen}>
        <View style={styles.statusBarPlaceholder} />

        {/* HEADER */}
        <View style={styles.headerRow}>
          {/* Gauche : bienvenue */}
          <Text style={styles.welcomeText}>Bienvenue, {currentUser.name}</Text>

          {/* Droite : paramètres + déconnexion */}
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => console.log('Paramètres')}>
              <Text style={styles.headerAction}>Paramètres</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginLeft: 12 }}>
              <Text style={styles.headerAction}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FILTRE CALENDRIER */}
        <View style={styles.calendarFilter}>
          <Text style={styles.filterText}>Aujourd'hui — 12 tâches</Text>
        </View>

        {/* LISTE CLIENTS */}
        <View style={styles.clientsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
            {clients.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.clientCard, selectedClient?.id === c.id && styles.clientCardActive]}
                onPress={() => setSelectedClient(c)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{c.avatar}</Text>
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.clientName}>{c.name}</Text>
                  <Text style={styles.clientAddr}>{c.address}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* PLACEHOLDER MAP */}
        <View style={styles.mapPlaceholder}>
          <MaterialCommunityIcons name="map-marker" size={48} color="#10b981" />
          <Text style={styles.mapText}>
            {selectedClient?.name} — {selectedClient?.address}
          </Text>
        </View>

        {/* BOTTOM NAVIGATION */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navBtn}>
            <MaterialCommunityIcons name="home" size={20} color="#064e3b" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn}>
            <MaterialCommunityIcons name="calendar" size={20} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn}>
            <MaterialCommunityIcons name="map" size={20} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn}>
            <MaterialCommunityIcons name="account" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1, paddingTop: 12 },
  statusBarPlaceholder: { height: 6 },

  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 18, 
    marginTop: 6 
  },
  welcomeText: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerAction: { color: '#059669', fontWeight: '700', fontSize: 14 },

  calendarFilter: { paddingHorizontal: 18, paddingVertical: 10 },
  filterText: { color: '#6b7280' },

  clientsBar: { height: 92, justifyContent: 'center' },
  clientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', padding: 10, borderRadius: 12, marginRight: 12, minWidth: 180 },
  clientCardActive: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  clientName: { fontWeight: '700' },
  clientAddr: { color: '#6b7280', fontSize: 12 },

  mapPlaceholder: { flex: 1, margin: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  mapText: { marginTop: 8, color: '#374151' },

  bottomNav: { height: 72, borderTopWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 24 },
  navBtn: { alignItems: 'center', justifyContent: 'center' },
  homeIndicator: { display: 'none' }
});
