import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Linking, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  Modal, 
  Image, 
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import MapView, { Marker } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../src/lib/supabase';
import * as Notifications from 'expo-notifications';

// Interface pour les clients avec les tâches
interface Client {
  id: string;
  uuid: string;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  priority: string;
  company_name: string | null;
  created_at: string;
  task_title: string | null;
  task_id: string | null;
  task_status: string | null;
  task_description?: string | null;
  task_date?: string | null;
  task_start_time?: string | null;
  task_end_time?: string | null;
}

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Calendrier: undefined;
  Wallet: undefined;
};

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<Client | null>(null);
  
  // États du formulaire
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [photo, setPhoto] = useState('');

  // Vérifier l'utilisateur depuis AsyncStorage
  useFocusEffect(
    React.useCallback(() => {
      checkUser();
    }, [])
  );

  const checkUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      console.log('User data from storage:', userData);
      
      if (userData) {
        const parsedUser = JSON.parse(userData);
        console.log('User connecté:', parsedUser);
        
        setUser(parsedUser);
        setName(parsedUser.nom || '');
        setEmail(parsedUser.email || '');
        setPhoto(parsedUser.photo || '');
        
        // Maintenant charger les clients assignés via les tâches
        fetchAssignedClients(parsedUser.id);
        // Demander la permission de notifications
        try { await requestNotificationPermissions(); } catch (e) { console.warn('Notif perm erreur', e); }
      } else {
        console.log('Pas d\'utilisateur connecté, redirection vers Login');
        navigation.navigate('Login');
      }
    } catch (error) {
      console.error('Erreur vérification utilisateur:', error);
      navigation.navigate('Login');
    }
  };

  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') return true;
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      return newStatus === 'granted';
    } catch (err) {
      console.error('Erreur permissions notifications:', err);
      return false;
    }
  };

  const fetchAssignedClients = async (userId: number) => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      // On ne récupère que les tâches pour aujourd'hui
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', userId)
        .eq('date', today)
        .order('date', { ascending: true });

      if (tasksError) {
        console.error('Erreur:', tasksError);
        return;
      }

      console.log('📋 Tâches trouvées:', tasksData?.length);
      if (!tasksData || tasksData.length === 0) {
        console.log('Aucune tâche trouvée pour aujourd\'hui');
        setClients([]);
        return;
      }

      // Créer les clients depuis les données des tâches
      const clientsFromTasks: Client[] = tasksData.map((task, index) => {
        const clientName = task.client_name || `Client ${index + 1}`;
        
        // Coordonnées par défaut (Kenitra, Maroc avec variation)
        const baseLat = 34.2610;
        const baseLng = -6.5802;
        
        return {
          id: task.client_id || task.id,
          uuid: task.client_id || task.id,
          name: clientName,
          address: task.address || 'Adresse non spécifiée',
          email: null,
          phone: task.client_phone || 'Non spécifié',
          avatar: getInitials(clientName),
          latitude: baseLat + (index * 0.001), // Légère variation
          longitude: baseLng + (index * 0.001),
          notes: task.description || `Tâche: ${task.title}`,
          priority: task.priority || 'Normal',
          company_name: null,
          created_at: task.created_at || new Date().toISOString(),
          task_title: task.title,
          task_id: task.id,
          task_status: task.status,
          task_description: task.description,
          task_date: task.date,
          task_start_time: task.start_time,
          task_end_time: task.end_time
        };
      });

      console.log('👥 Clients créés:');
      clientsFromTasks.forEach(client => {
        console.log(`  - ${client.name} (Tâche: ${client.task_title})`);
      });

      // Enlever les doublons
      const uniqueClients = clientsFromTasks.filter((client, index, self) =>
        index === self.findIndex(c => c.id === client.id)
      );

      console.log(`🎯 ${uniqueClients.length} clients uniques trouvés`);
      
      if (uniqueClients.length > 0) {
        setClients(uniqueClients);
        setSelectedClient(uniqueClients[0]);
        
        // Log important pour vérification
        console.log('========================================');
        console.log('NOM DU CLIENT À AFFICHER:', uniqueClients[0].name);
        console.log('TÂCHE ASSOCIÉE:', uniqueClients[0].task_title);
        console.log('========================================');
      }

      // Programmer les notifications pour les tâches de demain (si besoin)
      try {
        scheduleRemindersForTomorrow(userId);
      } catch (err) {
        console.error('Erreur programmation reminders:', err);
      }

    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fonction pour ouvrir l'itinéraire
  const handleShowDirections = (client: Client) => {
    if (!client.latitude || !client.longitude) {
      Alert.alert('Erreur', 'Coordonnées GPS non disponibles pour ce client');
      return;
    }
    
    // Ouvrir l'application de cartes par défaut
    const url = `https://www.google.com/maps/dir/?api=1&destination=${client.latitude},${client.longitude}`;
    
    Linking.openURL(url).catch(err => {
      console.error('Erreur ouverture carte:', err);
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application de cartes');
    });
  };

  const handleMarkerPress = (client: Client) => {
    setSelectedMarker(client);
    setModalVisible(true);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('userToken');
      navigation.navigate('Login');
    } catch (error) {
      console.error('Erreur déconnexion:', error);
      Alert.alert('Erreur', 'Impossible de se déconnecter');
    }
  };

  // Fonction pour obtenir les initiales
  const getInitials = (name: string | null): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Fonction pour formater la date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Date inconnue';
    }
  };

  // Fonction pour formater l'heure
  const formatTime = (timeString: string | null) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  // Obtenir la couleur du badge selon le statut
  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'terminé':
      case 'payé':
        return '#10b981';
      case 'in_progress':
      case 'en cours':
        return '#f59e0b';
      case 'pending':
      case 'en attente':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  // Obtenir le texte du statut
  const getStatusText = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'Terminé';
      case 'in_progress':
        return 'En cours';
      case 'pending':
        return 'En attente';
      default:
        return status || 'Inconnu';
    }
  };

  // Rafraîchir les données
  const refreshData = () => {
    setRefreshing(true);
    if (user) {
      fetchAssignedClients(user.id);
    }
  };

  // Schedule notifications for tasks happening tomorrow — called after fetching
  const scheduleRemindersForTomorrow = async (userId: number) => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', userId)
        .eq('date', tomorrowStr);

      if (error) {
        console.error('Erreur récupération tâches demain pour reminders:', error);
        return;
      }

      if (!tasksData || tasksData.length === 0) return;

      // Schedule one notification per task for the day BEFORE (today) at 09:00 local time
      for (const task of tasksData) {
        try {
          const now = Date.now();
          const notifyDate = new Date();
          // today at 09:00
          notifyDate.setHours(9, 0, 0, 0);
          // if it's already past 09:00, schedule in 10 seconds as fallback
          let seconds = Math.floor((notifyDate.getTime() - now) / 1000);
          if (seconds <= 0) seconds = 10;

          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Nouvelle tâche à faire pour demain',
              body: `${task.title || 'Tâche'} — ${task.client_name || ''}`,
              data: { taskId: task.id }
            },
            trigger: { seconds }
          });
        } catch (err) {
          console.error('Erreur schedule notification pour task', task.id, err);
        }
      }
    } catch (err) {
      console.error('Erreur scheduleRemindersForTomorrow:', err);
    }
  };

  // Si pas encore chargé
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.screen}>
        <View style={styles.statusBarPlaceholder} />

        {/* HEADER */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {photo ? (
              <Image 
                source={{ uri: photo }} 
                style={{ width: 36, height: 36, borderRadius: 18, marginRight: 8 }} 
              />
            ) : (
              <View style={{ 
                width: 36, 
                height: 36, 
                borderRadius: 18, 
                backgroundColor: '#10b981', 
                alignItems: 'center', 
                justifyContent: 'center', 
                marginRight: 8 
              }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {getInitials(name)}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.welcomeText}>Bienvenue, {name || 'Utilisateur'}</Text>
              <Text style={styles.emailText}>{email}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setSettingsModalVisible(true)} style={{ marginLeft: 16 }}>
              <MaterialCommunityIcons name="cog" size={24} color="#059669" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={{ marginLeft: 16 }}>
              <MaterialCommunityIcons name="logout" size={24} color="#059669" />
            </TouchableOpacity>
          </View>
        </View>

        {/* FILTRE */}
        <View style={styles.calendarFilter}>
          <Text style={styles.filterText}>
            {loading ? 'Chargement...' : `${clients.length} client${clients.length > 1 ? 's' : ''} assigné${clients.length > 1 ? 's' : ''}`}
          </Text>
          <TouchableOpacity onPress={refreshData}>
            <MaterialCommunityIcons name="refresh" size={20} color="#059669" />
          </TouchableOpacity>
        </View>

        {/* LISTE CLIENTS AVEC TÂCHES */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Chargement des clients...</Text>
          </View>
        ) : clients.length > 0 ? (
          <View style={styles.clientsBar}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={{ paddingHorizontal: 12 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refreshData} colors={['#10b981']} />
              }
            >
              {clients.map((client) => (
                <TouchableOpacity
                  key={client.id}
                  style={[styles.clientCard, selectedClient?.id === client.id && styles.clientCardActive]}
                  onPress={() => setSelectedClient(client)}
                >
                  <View style={[styles.avatar, { backgroundColor: '#10b981' }]}>
                    <Text style={styles.avatarText}>
                      {client.avatar || getInitials(client.name)}
                    </Text>
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.clientName} numberOfLines={1}>
                      {client.name}
                      {client.company_name && ` • ${client.company_name}`}
                    </Text>
                    
                    {/* Afficher le titre de la tâche */}
                    {client.task_title && (
                      <Text style={styles.taskTitle} numberOfLines={1}>
                        📋 {client.task_title}
                      </Text>
                    )}
                    
                    {/* Badge statut de la tâche */}
                    {client.task_status && (
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(client.task_status) + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(client.task_status) }]} />
                        <Text style={[styles.statusText, { color: getStatusColor(client.task_status) }]}>
                          {getStatusText(client.task_status)}
                        </Text>
                      </View>
                    )}
                    
                    {client.address ? (
                      <Text style={styles.clientAddr} numberOfLines={1}>{client.address}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="account-group" size={64} color="#d1d5db" />
                <Text style={styles.emptyText}>Aucun client</Text>
                <Text style={styles.emptySubText}>Vous n'aviez aucune tâche aujourd'hui</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={refreshData}>
              <Text style={styles.refreshButtonText}>Actualiser</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* CARTE */}
        {selectedClient && selectedClient.latitude && selectedClient.longitude ? (
          <View style={{ flex: 1, margin: 16, borderRadius: 12, overflow: 'hidden' }}>
            <MapView
              style={{ flex: 1 }}
              initialRegion={{
                latitude: selectedClient.latitude,
                longitude: selectedClient.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              provider="google"
            >
              {clients.map((client) => {
                if (!client.latitude || !client.longitude) return null;
                
                return (
                  <Marker
                    key={client.id}
                    coordinate={{
                      latitude: client.latitude,
                      longitude: client.longitude,
                    }}
                    title={client.name}
                    description={client.address || 'Pas d\'adresse'}
                    pinColor={selectedClient?.id === client.id ? "#10b981" : "#3b82f6"}
                    onPress={() => handleMarkerPress(client)}
                  />
                );
              })}
            </MapView>
          </View>
        ) : (
          <View style={styles.noMapContainer}>
            <MaterialCommunityIcons name="map-marker-off" size={64} color="#d1d5db" />
            <Text style={styles.noMapText}>
              {selectedClient ? 'Pas de coordonnées GPS pour ce client' : 'Sélectionnez un client'}
            </Text>
          </View>
        )}

        {/* BOTTOM NAVIGATION */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navBtn}>
            <MaterialCommunityIcons name="map" size={20} color="green" />
            <Text style={{ fontSize: 10, color: 'green' }}>Carte</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigation.navigate('Calendrier')}
          >
            <MaterialCommunityIcons name="calendar" size={20} color="#6b7280" />
            <Text style={{ fontSize: 10, color: '#6b7280' }}>Mon agenda</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.navBtn} 
            onPress={() => navigation.navigate('Wallet')}
          >
            <MaterialCommunityIcons name="wallet" size={20} color="#6b7280" />
            <Text style={{ fontSize: 10, color: '#6b7280' }}>Mon portefeuille</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL POPUP DU MARQUEUR */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails du client</Text>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedMarker && (
              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                {/* En-tête avec avatar et nom */}
                <View style={styles.clientHeader}>
                  <View style={[styles.clientAvatar, { backgroundColor: '#10b981' }]}>
                    <Text style={styles.clientAvatarText}>
                      {selectedMarker.avatar || getInitials(selectedMarker.name)}
                    </Text>
                  </View>
                  <View style={styles.clientHeaderInfo}>
                    <Text style={styles.clientNameModal} numberOfLines={1}>
                      {selectedMarker.name}
                    </Text>
                    {selectedMarker.company_name && (
                      <Text style={styles.clientCompany} numberOfLines={1}>
                        {selectedMarker.company_name}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Informations du client */}
                <View style={styles.infoSection}>
                  <Text style={styles.sectionTitle}>Informations</Text>
                  
                  {selectedMarker.address && (
                    <View style={styles.infoRow}>
                      <MaterialCommunityIcons name="map-marker" size={18} color="#6b7280" />
                      <Text style={styles.infoText} numberOfLines={3}>
                        {selectedMarker.address}
                      </Text>
                    </View>
                  )}
                  
                  {selectedMarker.phone && (
                    <View style={styles.infoRow}>
                      <MaterialCommunityIcons name="phone" size={18} color="#6b7280" />
                      <Text style={styles.infoText}>
                        {selectedMarker.phone}
                      </Text>
                    </View>
                  )}
                  
                  {selectedMarker.email && (
                    <View style={styles.infoRow}>
                      <MaterialCommunityIcons name="email" size={18} color="#6b7280" />
                      <Text style={styles.infoText} numberOfLines={1}>
                        {selectedMarker.email}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Tâches assignées */}
                {selectedMarker.task_title && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Tâches assignées</Text>
                    
                    <View style={styles.taskCardModal}>
                      <View style={styles.taskHeaderModal}>
                        <View style={styles.taskTitleContainer}>
                          <MaterialCommunityIcons name="clipboard-text" size={18} color="#10b981" />
                          <Text style={styles.taskTitleModal} numberOfLines={2}>
                            {selectedMarker.task_title}
                          </Text>
                        </View>
                        <View style={[styles.taskStatusBadgeModal, { backgroundColor: getStatusColor(selectedMarker.task_status) + '20' }]}>
                          <View style={[styles.taskStatusDotModal, { backgroundColor: getStatusColor(selectedMarker.task_status) }]} />
                          <Text style={[styles.taskStatusTextModal, { color: getStatusColor(selectedMarker.task_status) }]}>
                            {getStatusText(selectedMarker.task_status)}
                          </Text>
                        </View>
                      </View>
                      
                      {selectedMarker.task_description && (
                        <Text style={styles.taskDescriptionModal} numberOfLines={4}>
                          {selectedMarker.task_description}
                        </Text>
                      )}
                      
                      {/* Date et heure de la tâche */}
                      {(selectedMarker.task_date || selectedMarker.task_start_time) && (
                        <View style={styles.taskTimeSection}>
                          {selectedMarker.task_date && (
                            <View style={styles.taskTimeRow}>
                              <MaterialCommunityIcons name="calendar" size={14} color="#6b7280" />
                              <Text style={styles.taskTimeText}>
                                {formatDate(selectedMarker.task_date)}
                              </Text>
                            </View>
                          )}
                          
                          {(selectedMarker.task_start_time || selectedMarker.task_end_time) && (
                            <View style={styles.taskTimeRow}>
                              <MaterialCommunityIcons name="clock" size={14} color="#6b7280" />
                              <Text style={styles.taskTimeText}>
                                {formatTime(selectedMarker.task_start_time)}
                                {selectedMarker.task_end_time && ` - ${formatTime(selectedMarker.task_end_time)}`}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Notes */}
                {selectedMarker.notes && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    <View style={styles.notesBox}>
                      <MaterialCommunityIcons name="note-text" size={18} color="#f59e0b" />
                      <Text style={styles.notesTextModal} numberOfLines={5}>
                        {selectedMarker.notes}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Boutons d'action */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.directionsButtonModal]}
                    onPress={() => {
                      setModalVisible(false);
                      handleShowDirections(selectedMarker);
                    }}
                  >
                    <MaterialCommunityIcons name="directions" size={20} color="#fff" />
                    <Text style={styles.directionsButtonText}>Voir l'itinéraire</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.secondaryButton]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.secondaryButtonText}>Fermer</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL Paramètres du compte */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={settingsModalVisible}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <BlurView intensity={80} tint="dark" style={styles.blurBackground}>
          <View style={styles.modalContainerSettings}>
            <Text style={styles.modalTitle}>Modifier mon compte</Text>

            <Text style={styles.label}>Nom</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />

            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />

            <Text style={styles.label}>Photo URL (optionnel)</Text>
            <TextInput style={styles.input} value={photo} onChangeText={setPhoto} />

            <Text style={styles.label}>Mot de passe</Text>
            <TextInput 
              style={styles.input} 
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry 
              placeholder="Laisser vide pour ne pas changer" 
            />

            <TouchableOpacity style={styles.saveBtn} onPress={() => {}}>
              <Text style={styles.saveBtnText}>Enregistrer</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSettingsModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  screen: { 
    flex: 1, 
    paddingTop: 12 
  },
  statusBarPlaceholder: { 
    height: 6 
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 50,
  },
  welcomeText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0f172a' 
  },
  emailText: { 
    fontSize: 12, 
    color: '#6b7280' 
  },
  headerActions: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  calendarFilter: { 
    paddingHorizontal: 18, 
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterText: { 
    color: '#6b7280', 
    fontSize: 14 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  loadingText: { 
    marginTop: 12, 
    color: '#6b7280' 
  },
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20
  },
  emptyText: { 
    marginTop: 12, 
    color: '#374151',
    fontSize: 16,
    fontWeight: '600'
  },
  emptySubText: {
    marginTop: 8,
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20
  },
  refreshButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  clientsBar: { 
    height: 130, 
    justifyContent: 'center' 
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 300,
    maxWidth: 320,
  },
  clientCardActive: { 
    borderColor: '#10b981', 
    backgroundColor: '#ecfdf5',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  avatarText: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 16,
  },
  clientName: { 
    fontWeight: '700',
    fontSize: 14,
    color: '#0f172a',
  },
  taskTitle: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 2,
    marginBottom: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  clientAddr: { 
    color: '#6b7280', 
    fontSize: 12,
    marginTop: 2,
  },
  noMapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  noMapText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
  bottomNav: { 
    height: 72, 
    borderTopWidth: 1, 
    borderColor: '#e5e7eb', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-around', 
    paddingHorizontal: 24 
  },
  navBtn: { 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  blurBackground: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContainerSettings: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 16, 
    textAlign: 'center' 
  },
  label: { 
    fontSize: 14, 
    color: '#374151', 
    marginBottom: 6 
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  saveBtn: { 
    backgroundColor: '#10b981', 
    paddingVertical: 14, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginTop: 8 
  },
  saveBtnText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 16 
  },
  cancelBtn: { 
    marginTop: 12, 
    alignItems: 'center' 
  },
  cancelBtnText: { 
    color: '#059669', 
    fontWeight: '700' 
  },

  // Styles pour le modal popup du marqueur
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },

  // Client header in modal
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  clientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clientAvatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  clientHeaderInfo: {
    flex: 1,
  },
  clientNameModal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  clientCompany: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },

  // Info sections
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 10,
    flex: 1,
  },

  // Task card in modal
  taskCardModal: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  taskHeaderModal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  taskTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  taskTitleModal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginLeft: 8,
    flex: 1,
  },
  taskStatusBadgeModal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  taskStatusDotModal: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  taskStatusTextModal: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskDescriptionModal: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  taskTimeSection: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  taskTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTimeText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },

  // Notes box
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  notesTextModal: {
    fontSize: 14,
    color: '#92400e',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },

  // Action buttons
  actionButtons: {
    marginTop: 8,
    marginBottom: 20,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 12,
  },
  directionsButtonModal: {
    backgroundColor: '#10b981',
  },
  directionsButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 16,
  },
});