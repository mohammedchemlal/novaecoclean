import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Platform,
  AppState,
  AppStateStatus
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../src/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Calendrier: undefined;
  Map: undefined;
  Wallet: undefined;
};

interface Task {
  id: string;
  title: string;
  client_name: string;
  client_type: string;
  client_phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  description: string;
  date: string;
  notes: string;
  color: string;
  icon: string;
  completed_at?: string;
  estimated_coordinates?: { lat: number; lng: number };
}

interface DayInfo {
  date: string;
  dayNumber: number;
  dayName: string;
  isSelected: boolean;
  isToday: boolean;
  taskCount: number;
  hasTasks: boolean;
}

interface ActiveVisit {
  taskId: string;
  startTime: number;
  duration: number;
  remainingTime: number;
  isCompleted: boolean;
  clientName: string;
  address: string;
}

// Configuration des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const GEOFENCE_RADIUS = 200; // 200 mètres exactement
const GEOFENCING_TASK = 'geofencing-task';
const LOCATION_UPDATE_INTERVAL = 10000; // 10 secondes

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Date invalide';
    }
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

    const dayName = dayNames[date.getDay()];
    const dayNumber = date.getDate();
    const monthName = monthNames[date.getMonth()];
    const year = date.getFullYear();

    if (isToday) return `Aujourd'hui, ${dayNumber} ${monthName} ${year}`;
    if (isTomorrow) return `Demain, ${dayNumber} ${monthName} ${year}`;
    if (isYesterday) return `Hier, ${dayNumber} ${monthName} ${year}`;
    
    return `${dayName} ${dayNumber} ${monthName} ${year}`;
  } catch {
    return 'Date non disponible';
  }
};

const formatShortDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const today = new Date();
    
    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = new Date(today.getTime() + 86400000).toDateString() === date.toDateString();
    const isYesterday = new Date(today.getTime() - 86400000).toDateString() === date.toDateString();

    if (isToday) return 'Auj';
    if (isTomorrow) return 'Dem';
    if (isYesterday) return 'Hier';
    
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return dayNames[date.getDay()];
  } catch {
    return '???';
  }
};

// Définir la tâche de géolocalisation pour les géofences
if (Platform.OS !== 'web' && TaskManager.isTaskDefined(GEOFENCING_TASK)) {
  TaskManager.defineTask(GEOFENCING_TASK, ({ data: { eventType, region }, error }) => {
    if (error) {
      console.error('Erreur géolocalisation:', error);
      return;
    }
    
    if (eventType === Location.GeofencingEventType.Enter) {
      console.log(`✅ Entré dans la zone: ${region.identifier}`);
      handleGeofenceEnter(region.identifier);
    }
    
    if (eventType === Location.GeofencingEventType.Exit) {
      console.log(`🚪 Sorti de la zone: ${region.identifier}`);
    }
  });
}

// Fonction globale pour gérer l'entrée dans une géofence
const handleGeofenceEnter = async (taskId: string) => {
  try {
    console.log(`Début de la visite pour la tâche: ${taskId}`);
    
    // Planifier une notification locale
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Visite démarrée',
        body: 'Vous êtes à proximité du client. La visite a commencé.',
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Erreur lors de la gestion de la géofence:', error);
  }
};

export default function CalendrierScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{ 
    name: string; 
    avatar: string;
    id: string;
  }>({ name: 'Chargement...', avatar: 'U', id: '' });
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [activeVisit, setActiveVisit] = useState<ActiveVisit | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null);
  const [visitedTasks, setVisitedTasks] = useState<string[]>([]);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const appState = useRef(AppState.currentState);
  // Enregistre la première entrée dans le périmètre pour chaque tâche (timestamp en ms)
  const proximityEntryTimes = useRef<Record<string, number>>({});

  // Vérifier l'authentification
  const checkAuth = async (): Promise<boolean> => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      return !!userData;
    } catch (err) {
      console.error('Auth check error:', err);
      return false;
    }
  };

  // Demander les permissions de notification
  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  };

  // Initialiser la géolocalisation
const initLocationTracking = async () => {
  try {
    console.log('🛰️ Initialisation de la géolocalisation...');
    
    // D'abord, vérifier si le plugin est correctement configuré
    console.log('Vérification des permissions...');
    
    // Demander les permissions AVANT d'utiliser Location
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      console.log('Permission de localisation refusée:', foregroundStatus);
      Alert.alert(
        'Permission requise',
        'La géolocalisation est nécessaire pour détecter quand vous êtes proche d\'un client',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    console.log('Permission de localisation accordée:', foregroundStatus);
    setLocationPermission(true);

    // Essayer de demander les permissions en arrière-plan pour iOS
    if (Platform.OS === 'ios') {
      try {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        console.log('Permission arrière-plan iOS:', backgroundStatus);
      } catch (bgError) {
        console.log('Erreur permission arrière-plan iOS:', bgError);
      }
    }

    // Obtenir la position actuelle
    console.log('Récupération de la position actuelle...');
    const currentLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    setLocation(currentLocation);
    
    console.log('Position obtenue:', {
      lat: currentLocation.coords.latitude,
      lng: currentLocation.coords.longitude
    });
    
    // Commencer à suivre la position
    await startLocationTracking();
    
    // Initialiser les notifications
    await requestNotificationPermissions();
    
    console.log('✅ Géolocalisation initialisée avec succès');
    return true;
  } catch (error: any) {
    console.error('❌ Erreur initialisation géolocalisation:', error);
    
    // Message d'erreur plus détaillé
    let errorMessage = 'Impossible d\'initialiser la géolocalisation';
    
    if (error.code === 'E_LOCATION_INFO_PLIST') {
      errorMessage = 'Permissions de localisation manquantes dans la configuration iOS. Veuillez contacter le développeur.';
    } else if (error.message.includes('NSLocation')) {
      errorMessage = 'Configuration des permissions de localisation incorrecte pour iOS.';
    }
    
    Alert.alert(
      'Erreur de géolocalisation',
      errorMessage,
      [{ text: 'OK' }]
    );
    
    return false;
  }
};

  // Démarrer le suivi de localisation
  const startLocationTracking = async () => {
    try {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10, // Mettre à jour toutes les 10m
          timeInterval: LOCATION_UPDATE_INTERVAL,
        },
        (newLocation) => {
          setLocation(newLocation);
          checkProximityToTasks(newLocation);
        }
      );

      setIsTracking(true);
      console.log('📍 Suivi de localisation démarré');
    } catch (error) {
      console.error('Erreur démarrage suivi localisation:', error);
    }
  };

  // Calculer la distance entre deux points (en mètres)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Rayon de la Terre en mètres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Vérifier la proximité avec les tâches
  const checkProximityToTasks = (currentLocation: Location.LocationObject) => {
    try {
      const todayTasks = allTasks.filter(task => 
        task.date === selectedDate && 
        task.status !== 'completed' && 
        task.status !== 'cancelled'
      );

      const PROXIMITY_WAIT_MS = 2 * 60 * 1000; // 2 minutes
      const now = Date.now();

      todayTasks.forEach((task) => {
        if (!task.latitude || !task.longitude) {
          return;
        }

        // Skip si déjà en cours ou visitée
        if (activeVisit?.taskId === task.id || visitedTasks.includes(task.id)) {
          // nettoyer toute entrée précédente
          if (proximityEntryTimes.current[task.id]) delete proximityEntryTimes.current[task.id];
          return;
        }

        const distance = calculateDistance(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          task.latitude,
          task.longitude
        );

        if (distance <= GEOFENCE_RADIUS) {
          const first = proximityEntryTimes.current[task.id];
          if (!first) {
            proximityEntryTimes.current[task.id] = now;
            console.log(`🕒 Entrée dans périmètre pour ${task.id} à ${now}`);
          } else {
            const elapsed = now - first;
            // Si l'utilisateur reste 2 minutes à l'intérieur, démarrer la visite
            if (elapsed >= PROXIMITY_WAIT_MS) {
              delete proximityEntryTimes.current[task.id];
              console.log(`✅ Présent 2min dans périmètre, démarrage visite ${task.id}`);
              startVisit(task);
            } else {
              // debug
              console.log(`⌛ ${task.id} proximité ${Math.round(elapsed/1000)}s`);
            }
          }
        } else {
          // Si sort du périmètre, réinitialiser le timer
          if (proximityEntryTimes.current[task.id]) {
            delete proximityEntryTimes.current[task.id];
            console.log(`🚪 Sorti du périmètre pour ${task.id}`);
          }
        }
      });
    } catch (error) {
      console.error('Erreur vérification proximité:', error);
    }
  };


  // Démarrer une visite
  const startVisit = async (task: Task) => {
    try {
      if (activeVisit && activeVisit.taskId !== task.id) {
        Alert.alert('Visite en cours', 'Une autre visite est déjà en cours. Terminez-la avant d\'en démarrer une nouvelle.');
        return;
      }
      console.log(`🚀 Démarrage visite: ${task.client_name}`);
      
      // Mettre à jour le statut dans Supabase
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (error) throw error;

      // Mettre à jour localement
      const updatedTasks = allTasks.map(t => 
        t.id === task.id ? { ...t, status: 'in_progress' } : t
      );
      setAllTasks(updatedTasks);

      // Configurer la visite active
      const durationMs = task.duration_minutes * 60 * 1000;
      const startTime = Date.now();
      
      const newActiveVisit: ActiveVisit = {
        taskId: task.id,
        startTime,
        duration: durationMs,
        remainingTime: durationMs,
        isCompleted: false,
        clientName: task.client_name,
        address: task.address
      };

      setActiveVisit(newActiveVisit);

      // Démarrer le compte à rebours
      const interval = setInterval(() => {
        setActiveVisit(prev => {
          if (!prev) return null;
          
          const elapsed = Date.now() - prev.startTime;
          const remaining = Math.max(0, prev.duration - elapsed);
          
          if (remaining <= 0) {
            // Arrêter l'intervalle
            clearInterval(interval);
            
            // Afficher une notification
            Notifications.scheduleNotificationAsync({
              content: {
                title: 'Temps écoulé',
                body: `Le temps de visite chez ${prev.clientName} est écoulé`,
                sound: true,
              },
              trigger: null,
            });
            
            return { ...prev, remainingTime: 0, isCompleted: true };
          }
          
          return { ...prev, remainingTime: remaining };
        });
      }, 1000);

      setCountdownInterval(interval);

      // Notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Visite démarrée',
          body: `Visite chez ${task.client_name} commencée. Temps: ${task.duration_minutes} min`,
          sound: true,
        },
        trigger: null,
      });

      Alert.alert(
        'Visite commencée',
        `Vous êtes à proximité de ${task.client_name}. La visite de ${task.duration_minutes} minutes a commencé.`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Erreur démarrage visite:', error);
      Alert.alert('Erreur', 'Impossible de démarrer la visite');
    }
  };

  // Terminer une visite
  const completeVisit = async () => {
    if (!activeVisit) return;

    try {
      console.log(`✅ Fin de visite: ${activeVisit.clientName}`);
      
      // Arrêter le compte à rebours
      if (countdownInterval) {
        clearInterval(countdownInterval);
        setCountdownInterval(null);
      }

      // Mettre à jour dans Supabase
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', activeVisit.taskId);

      if (error) throw error;

      // Mettre à jour localement
      const updatedTasks = allTasks.map(task => 
        task.id === activeVisit.taskId ? { 
          ...task, 
          status: 'completed',
          completed_at: new Date().toISOString()
        } : task
      );
      setAllTasks(updatedTasks);

      // Ajouter aux tâches visitées
      setVisitedTasks(prev => [...prev, activeVisit.taskId]);

      // Enregistrer la visite dans la table `visits`
      try {
        const startISO = new Date(activeVisit.startTime).toISOString();
        const endISO = new Date().toISOString();
        const durationSeconds = Math.round((Date.now() - activeVisit.startTime) / 1000);
        const durationMinutes = Math.round(durationSeconds / 60);

        const { error: visitError } = await supabase
          .from('visits')
          .insert([{ 
            task_id: activeVisit.taskId,
            employee_id: currentUser.id,
            start_time: startISO,
            end_time: endISO,
            duration_seconds: durationSeconds,
            duration_minutes: durationMinutes,
            date: new Date().toISOString().split('T')[0]
          }]);

        if (visitError) console.error('Erreur insertion visite:', visitError);
      } catch (err) {
        console.error('Erreur enregistrement visite:', err);
      }

      // Notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Visite terminée',
          body: `Visite chez ${activeVisit.clientName} marquée comme terminée`,
          sound: true,
        },
        trigger: null,
      });

      // Réinitialiser
      setActiveVisit(null);

      Alert.alert(
        'Visite terminée',
        `La visite chez ${activeVisit.clientName} a été marquée comme terminée.`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Erreur fin de visite:', error);
      Alert.alert('Erreur', 'Impossible de terminer la visite');
    }
  };

  // Formater le temps restant
  const formatTimeRemaining = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Géocoder une adresse (simulé - à remplacer par un vrai service)
  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      // En production, utiliser un service comme Google Maps Geocoding
      // Pour la démo, retourner des coordonnées aléatoires près de Paris
      return {
        lat: 48.8566 + (Math.random() - 0.5) * 0.1,
        lng: 2.3522 + (Math.random() - 0.5) * 0.1
      };
    } catch (error) {
      console.error('Erreur géocodage:', error);
      return null;
    }
  };

  // Récupérer les tâches
  const fetchUserAndTasks = async () => {
    setIsLoading(true);
    try {
      console.log('=== DÉBUT fetchUserAndTasks ===');
      
      const userData = await AsyncStorage.getItem('userData');
      
      if (!userData) {
        console.log('❌ Pas de userData - Redirection Login');
        navigation.navigate('Login');
        return;
      }

      const user = JSON.parse(userData);
      const avatar = user.nom?.charAt(0).toUpperCase() || 'U';
      
      setCurrentUser({
        name: user.nom,
        avatar,
        id: user.id
      });

      // Récupérer les tâches
      const { data: userTasks, error: userError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (userError) throw userError;

      console.log(`✅ Tâches trouvées: ${userTasks?.length || 0}`);
      
      // Géocoder les adresses qui n'ont pas de coordonnées
      const tasksWithCoords = await Promise.all(
        (userTasks || []).map(async (task) => {
          let lat = task.latitude;
          let lng = task.longitude;
          
          if (!lat || !lng) {
            const coords = await geocodeAddress(task.address);
            if (coords) {
              lat = coords.lat;
              lng = coords.lng;
            }
          }
          
          return {
            id: task.id,
            title: task.title || 'Tâche sans titre',
            client_name: task.client_name || 'Client',
            client_type: task.client_type || 'Particulier',
            client_phone: task.client_phone || '',
            address: task.address || 'Adresse non spécifiée',
            latitude: lat,
            longitude: lng,
            start_time: task.start_time || '09:00',
            end_time: task.end_time || '10:00',
            duration_minutes: task.duration_minutes || 60,
            status: task.status || 'pending',
            priority: task.priority || 'medium',
            description: task.description || '',
            date: task.date || new Date().toISOString().split('T')[0],
            notes: task.notes || '',
            color: task.color || '#10b981',
            icon: task.icon || 'cog',
            completed_at: task.completed_at
          };
        })
      );

      setAllTasks(tasksWithCoords);

      // Vérifier les visites actives
      const inProgressTasks = tasksWithCoords.filter(task => task.status === 'in_progress');
      if (inProgressTasks.length > 0) {
        const task = inProgressTasks[0];
        const durationMs = task.duration_minutes * 60 * 1000;
        
        // Pour simplifier, on redémarre le compte à rebours
        // En production, vous devriez sauvegarder l'heure de début
        setActiveVisit({
          taskId: task.id,
          startTime: Date.now() - (durationMs / 2), // Mi-chemin pour la démo
          duration: durationMs,
          remainingTime: durationMs / 2,
          isCompleted: false,
          clientName: task.client_name,
          address: task.address
        });
      }

    } catch (error: any) {
      console.error('💥 ERREUR GLOBALE:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Une erreur est survenue',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      console.log('=== FIN fetchUserAndTasks ===');
    }
  };

  const handleViewDetails = (task: Task) => {
    setSelectedTask(task);
    setModalVisible(true);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserAndTasks();
  };

  // Gestionnaire d'état de l'application
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('📱 Application revenue au premier plan');
        fetchUserAndTasks();
        if (locationPermission) {
          startLocationTracking();
        }
      }
      
      if (nextAppState === 'background') {
        console.log('📱 Application en arrière-plan');
        if (locationSubscription.current) {
          locationSubscription.current.remove();
          setIsTracking(false);
        }
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await fetchUserAndTasks();
      await initLocationTracking();
    };
    initialize();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchUserAndTasks();
    }, [])
  );

  const getWeekDays = (): DayInfo[] => {
    const days: DayInfo[] = [];
    const currentDate = new Date(selectedDate);
    
    for (let i = -3; i <= 3; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      const isSelected = dateString === selectedDate;
      const isToday = dateString === new Date().toISOString().split('T')[0];
      const taskCount = allTasks.filter(task => task.date === dateString).length;
      
      days.push({
        date: dateString,
        dayNumber: date.getDate(),
        dayName: formatShortDate(dateString),
        isSelected,
        isToday,
        taskCount,
        hasTasks: taskCount > 0,
      });
    }
    
    return days;
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const jumpToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const getStatusColor = (status: string): string => {
    switch(status) {
      case 'confirmed': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'cancelled': return '#ef4444';
      case 'in_progress': return '#3b82f6';
      case 'completed': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string): string => {
    switch(status) {
      case 'confirmed': return 'Confirmé';
      case 'pending': return 'En attente';
      case 'cancelled': return 'Annulé';
      case 'in_progress': return 'En cours';
      case 'completed': return 'Terminé';
      default: return '';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch(priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getPriorityText = (priority: string): string => {
    switch(priority) {
      case 'high': return 'Haute';
      case 'medium': return 'Moyenne';
      case 'low': return 'Basse';
      default: return '';
    }
  };

  const filteredTasks = allTasks
    .filter(task => task.date === selectedDate)
    .sort((a, b) => {
      const timeA = a.start_time.replace(':', '');
      const timeB = b.start_time.replace(':', '');
      return parseInt(timeA) - parseInt(timeB);
    });

  const weekDays = getWeekDays();
  const todayTasksCount = allTasks.filter(task => task.date === new Date().toISOString().split('T')[0]).length;

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Chargement de l'agenda...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.screen}>
        <View style={styles.statusBarPlaceholder} />

        {/* HEADER */}
        <View style={styles.headerRow}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{currentUser.avatar}</Text>
            </View>
            <View>
              <Text style={styles.welcomeText}>Bonjour, {currentUser.name}</Text>
              <Text style={styles.userRole}>
                {locationPermission ? '📍 Localisation active' : '📍 Localisation désactivée'}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={fetchUserAndTasks}>
              <MaterialCommunityIcons name="refresh" size={22} color="#059669" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => {
                if (locationPermission) {
                  startLocationTracking();
                } else {
                  initLocationTracking();
                }
              }}
            >
              <MaterialCommunityIcons 
                name={locationPermission ? "map-marker-radius" : "map-marker-off"} 
                size={22} 
                color={locationPermission ? "#059669" : "#ef4444"} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* VISITE ACTIVE */}
        {activeVisit && (
          <View style={styles.activeVisitContainer}>
            <View style={styles.activeVisitContent}>
              <View style={styles.activeVisitHeader}>
                <MaterialCommunityIcons 
                  name="clock" 
                  size={20} 
                  color={activeVisit.isCompleted ? "#10b981" : "#3b82f6"} 
                />
                <Text style={styles.activeVisitTitle}>
                  {activeVisit.isCompleted ? 'Visite terminée' : 'Visite en cours'}
                </Text>
              </View>
              <Text style={styles.activeVisitClient}>
                {activeVisit.clientName}
              </Text>
              <Text style={styles.activeVisitAddress}>
                {activeVisit.address}
              </Text>
              {!activeVisit.isCompleted && (
                <Text style={styles.activeVisitTime}>
                  ⏱️ Temps restant: {formatTimeRemaining(activeVisit.remainingTime)}
                </Text>
              )}
              <Text style={[styles.activeVisitTime, { marginTop: 6 }]}>⏱️ Durée écoulée: {formatTimeRemaining(activeVisit.duration - activeVisit.remainingTime)}</Text>

              <TouchableOpacity 
                style={[
                  styles.completeButton,
                  activeVisit.isCompleted && styles.completeButtonDisabled
                ]}
                onPress={completeVisit}
                disabled={activeVisit.isCompleted}
              >
                <MaterialCommunityIcons 
                  name={activeVisit.isCompleted ? "check-circle" : "stop-circle"} 
                  size={18} 
                  color="#fff" 
                />
                <Text style={styles.completeButtonText}>
                  Terminer la visite
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* QUICK STATS */}
        <View style={styles.quickStats}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="calendar-check" size={24} color="#10b981" />
            <Text style={styles.statNumber}>{todayTasksCount}</Text>
            <Text style={styles.statLabel}>Aujourd'hui</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="run" size={24} color="#3b82f6" />
            <Text style={styles.statNumber}>
              {allTasks.filter(t => t.status === 'in_progress').length}
            </Text>
            <Text style={styles.statLabel}>En cours</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="calendar-month" size={24} color="#8b5cf6" />
            <Text style={styles.statNumber}>{allTasks.length}</Text>
            <Text style={styles.statLabel}>Total RDV</Text>
          </View>
        </View>

        {/* SELECTEUR DE JOUR */}
        <View style={styles.daySelectorContainer}>
          <TouchableOpacity 
            style={styles.navArrow}
            onPress={() => navigateDay('prev')}
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color="#374151" />
          </TouchableOpacity>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daysScrollContent}
          >
            {weekDays.map((day) => (
              <TouchableOpacity
                key={day.date}
                style={[
                  styles.dayButton,
                  day.isSelected && styles.dayButtonSelected,
                  day.isToday && !day.isSelected && styles.dayButtonToday
                ]}
                onPress={() => setSelectedDate(day.date)}
              >
                <Text style={[
                  styles.dayName,
                  day.isSelected && styles.dayNameSelected,
                  day.isToday && !day.isSelected && styles.dayNameToday
                ]}>
                  {day.dayName}
                </Text>
                <Text style={[
                  styles.dayNumber,
                  day.isSelected && styles.dayNumberSelected,
                  day.isToday && !day.isSelected && styles.dayNumberToday
                ]}>
                  {day.dayNumber}
                </Text>
                {day.hasTasks && (
                  <View style={[
                    styles.dayTaskDot,
                    day.isSelected && styles.dayTaskDotSelected
                  ]} />
                )}
                {day.taskCount > 0 && !day.isSelected && (
                  <Text style={styles.dayTaskCount}>{day.taskCount}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity 
            style={styles.navArrow}
            onPress={() => navigateDay('next')}
          >
            <MaterialCommunityIcons name="chevron-right" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* DATE ACTUELLE ET BOUTON TODAY */}
        <View style={styles.currentDateContainer}>
          <View style={styles.dateInfo}>
            <MaterialCommunityIcons name="calendar" size={20} color="#10b981" />
            <Text style={styles.currentDateText}>
              {formatDate(selectedDate)}
            </Text>
            {filteredTasks.length > 0 && (
              <View style={styles.tasksCountBadge}>
                <Text style={styles.tasksCountText}>{filteredTasks.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity 
            style={styles.todayButton}
            onPress={jumpToToday}
          >
            <Text style={styles.todayButtonText}>Aujourd'hui</Text>
          </TouchableOpacity>
        </View>

        {/* LISTE DES TÂCHES */}
        <ScrollView 
          style={styles.tasksContainer} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10b981']} />
          }
        >
          {/* TIMELINE */}
          <View style={styles.timelineContainer}>
            {filteredTasks.map((task) => (
              <View key={task.id} style={styles.timelineItem}>
                <View style={styles.timelineTime}>
                  <Text style={styles.timelineHour}>{task.start_time}</Text>
                  <Text style={styles.timelineDuration}>{task.duration_minutes}min</Text>
                </View>
                
                <View style={[styles.timelineCard, { borderLeftColor: task.color }]}>
                  <View style={styles.timelineCardHeader}>
                    <View style={styles.taskTypeBadge}>
                      <MaterialCommunityIcons 
                        name={task.icon as any} 
                        size={16} 
                        color={task.color} 
                      />
                      <Text style={[styles.taskTypeText, { color: task.color }]}>
                        {task.title.split(' ')[0]}
                      </Text>
                    </View>
                    
                    <View style={styles.taskStatusRow}>
                      <View style={[
                        styles.priorityBadge,
                        { backgroundColor: getPriorityColor(task.priority) + '20' }
                      ]}>
                        <Text style={[
                          styles.priorityText,
                          { color: getPriorityColor(task.priority) }
                        ]}>
                          {getPriorityText(task.priority)}
                        </Text>
                      </View>
                      
                      <View style={[
                        styles.statusBadge, 
                        { backgroundColor: getStatusColor(task.status) + '20' }
                      ]}>
                        <Text style={[
                          styles.statusText, 
                          { color: getStatusColor(task.status) }
                        ]}>
                          {getStatusText(task.status)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <Text style={styles.timelineClient}>{task.client_name}</Text>
                  <Text style={styles.timelineAddress}>{task.address}</Text>
                  
                  <View style={styles.timelineFooter}>
                    <View style={styles.clientInfo}>
                      <MaterialCommunityIcons name="phone" size={14} color="#6b7280" />
                      <Text style={styles.clientPhone}>{task.client_phone}</Text>
                      {task.latitude && task.longitude && (
                        <MaterialCommunityIcons 
                          name="map-marker" 
                          size={14} 
                          color="#3b82f6" 
                          style={{ marginLeft: 8 }}
                        />
                      )}
                    </View>
                    
                    <TouchableOpacity 
                      style={[
                        styles.detailsButton,
                        task.status === 'in_progress' && styles.detailsButtonActive
                      ]}
                      onPress={() => handleViewDetails(task)}
                    >
                      <Text style={[
                        styles.detailsButtonText,
                        task.status === 'in_progress' && styles.detailsButtonTextActive
                      ]}>
                        {task.status === 'in_progress' ? 'En cours' : 'Voir détails'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  {task.notes && (
                    <View style={styles.notesContainer}>
                      <MaterialCommunityIcons name="note-text" size={14} color="#f59e0b" />
                      <Text style={styles.notesText}>{task.notes}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
            
            {filteredTasks.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-blank" size={64} color="#d1d5db" />
                <Text style={styles.emptyStateTitle}>Aucune tâche aujourd'hui</Text>
                <Text style={styles.emptyStateText}>
                  Vous n'avez pas de tâches programmées pour cette journée
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
        
        {/* NAVIGATION DU BAS */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigation.navigate('Home')}
          >
            <MaterialCommunityIcons name="map" size={20} color="#6b7280" />
            <Text style={styles.navBtnText}>Carte</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn}>
            <MaterialCommunityIcons name="calendar" size={20} color="green" />
            <Text style={[styles.navBtnText, { color: 'green' }]}>Mon agenda</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.navBtn}
            onPress={() => navigation.navigate('Wallet')}
          >
            <MaterialCommunityIcons name="wallet" size={20} color="#6b7280" />
            <Text style={styles.navBtnText}>Mon portefeuille</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL POUR LES DÉTAILS DE LA TÂCHE */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails de la tâche</Text>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedTask && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.taskHeader}>
                  <View style={[styles.taskIcon, { backgroundColor: selectedTask.color + '20' }]}>
                    <MaterialCommunityIcons 
                      name={selectedTask.icon as any} 
                      size={24} 
                      color={selectedTask.color} 
                    />
                  </View>
                  <View style={styles.taskTitleContainer}>
                    <Text style={styles.modalTaskTitle}>{selectedTask.title}</Text>
                    <View style={[
                      styles.statusBadgeModal,
                      { backgroundColor: getStatusColor(selectedTask.status) + '20' }
                    ]}>
                      <Text style={[
                        styles.statusTextModal,
                        { color: getStatusColor(selectedTask.status) }
                      ]}>
                        {getStatusText(selectedTask.status)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.infoSection}>
                  <Text style={styles.sectionTitle}>Client</Text>
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="account" size={18} color="#6b7280" />
                    <Text style={styles.infoText}>{selectedTask.client_name}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="phone" size={18} color="#6b7280" />
                    <Text style={styles.infoText}>{selectedTask.client_phone || 'Non spécifié'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="office-building" size={18} color="#6b7280" />
                    <Text style={styles.infoText}>{selectedTask.client_type}</Text>
                  </View>
                </View>

                <View style={styles.infoSection}>
                  <Text style={styles.sectionTitle}>Adresse</Text>
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="map-marker" size={18} color="#6b7280" />
                    <Text style={styles.infoText}>{selectedTask.address}</Text>
                  </View>
                  {selectedTask.latitude && selectedTask.longitude && (
                    <View style={styles.locationInfo}>
                      <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#3b82f6" />
                      <Text style={styles.locationText}>
                        Coordonnées GPS: {selectedTask.latitude.toFixed(6)}, {selectedTask.longitude.toFixed(6)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.infoSection}>
                  <Text style={styles.sectionTitle}>Date et heure</Text>
                  <View style={styles.timeInfo}>
                    <View style={styles.timeItem}>
                      <MaterialCommunityIcons name="calendar" size={18} color="#6b7280" />
                      <Text style={styles.infoText}>
                        {formatDate(selectedTask.date)}
                      </Text>
                    </View>
                    <View style={styles.timeRow}>
                      <View style={styles.timeItem}>
                        <MaterialCommunityIcons name="clock-start" size={18} color="#6b7280" />
                        <Text style={styles.infoText}>{selectedTask.start_time}</Text>
                      </View>
                      <MaterialCommunityIcons name="arrow-right" size={16} color="#9ca3af" />
                      <View style={styles.timeItem}>
                        <MaterialCommunityIcons name="clock-end" size={18} color="#6b7280" />
                        <Text style={styles.infoText}>{selectedTask.end_time}</Text>
                      </View>
                    </View>
                    <View style={styles.timeItem}>
                      <MaterialCommunityIcons name="timer" size={18} color="#6b7280" />
                      <Text style={styles.infoText}>{selectedTask.duration_minutes} minutes</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.infoSection}>
                  <Text style={styles.sectionTitle}>Priorité</Text>
                  <View style={[
                    styles.priorityBadgeModal,
                    { backgroundColor: getPriorityColor(selectedTask.priority) + '20' }
                  ]}>
                    <Text style={[
                      styles.priorityTextModal,
                      { color: getPriorityColor(selectedTask.priority) }
                    ]}>
                      {getPriorityText(selectedTask.priority)}
                    </Text>
                  </View>
                </View>

                {selectedTask.description && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.descriptionText}>{selectedTask.description}</Text>
                  </View>
                )}

                {selectedTask.notes && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    <View style={styles.notesBox}>
                      <MaterialCommunityIcons name="note-text" size={18} color="#f59e0b" />
                      <Text style={styles.notesText}>{selectedTask.notes}</Text>
                    </View>
                  </View>
                )}

                {/* Boutons d'action */}
                <View style={styles.actionButtons}>
                  {selectedTask && (() => {
                    const isNearby = selectedTask.latitude && selectedTask.longitude && location
                      ? calculateDistance(location.coords.latitude, location.coords.longitude, selectedTask.latitude, selectedTask.longitude) <= GEOFENCE_RADIUS
                      : false;

                    if (selectedTask.status !== 'in_progress') {
                      return (
                        <TouchableOpacity 
                          style={[styles.actionButton, isNearby ? styles.completeVisitButton : styles.secondaryButton]}
                          onPress={() => { if (isNearby) startVisit(selectedTask); else Alert.alert('Proximité requise', 'Vous devez être à moins de 200m pour démarrer la visite automatiquement.'); }}
                        >
                          <MaterialCommunityIcons name="play-circle" size={18} color="#fff" />
                          <Text style={styles.completeVisitButtonText}>Démarrer la visite</Text>
                        </TouchableOpacity>
                      );
                    }
                    return null;
                  })()}
                  {selectedTask.status === 'in_progress' && activeVisit?.taskId === selectedTask.id && (
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.completeVisitButton]}
                      onPress={completeVisit}
                    >
                      <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
                      <Text style={styles.completeVisitButtonText}>
                        {activeVisit.isCompleted ? 'Terminer la visite' : 'En attente...'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  {selectedTask.status === 'confirmed' && (
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.confirmButton]}
                      onPress={() => {
                        Alert.alert('Confirmation', 'Voulez-vous confirmer cette tâche?');
                      }}
                    >
                      <MaterialCommunityIcons name="check" size={18} color="#fff" />
                      <Text style={styles.confirmButtonText}>Confirmer</Text>
                    </TouchableOpacity>
                  )}
                  
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  screen: { flex: 1, paddingTop: 12 },
  statusBarPlaceholder: { height: 6 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280'
  },

  headerRow: {
    flexDirection: 'row',
    marginTop: 42,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  welcomeText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0f172a',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 13,
    color: '#6b7280',
  },
  headerActions: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  iconButton: {
    marginLeft: 16,
    padding: 4,
    position: 'relative',
  },

  // Active Visit Banner
  activeVisitContainer: {
    backgroundColor: '#dbeafe',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  activeVisitContent: {
    padding: 16,
  },
  activeVisitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeVisitTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e40af',
    marginLeft: 8,
  },
  activeVisitClient: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  activeVisitAddress: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  activeVisitTime: {
    fontSize: 14,
    color: '#3b82f6',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
    marginBottom: 12,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  completeButtonDisabled: {
    backgroundColor: '#6b7280',
  },
  completeButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },

  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },

  daySelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  navArrow: {
    padding: 8,
    borderRadius: 8,
  },
  daysScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  dayButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 12,
    minWidth: 56,
    position: 'relative',
  },
  dayButtonSelected: {
    backgroundColor: '#10b981',
  },
  dayButtonToday: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  dayName: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  dayNameSelected: {
    color: '#ffffff',
  },
  dayNameToday: {
    color: '#10b981',
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  dayNumberSelected: {
    color: '#ffffff',
  },
  dayNumberToday: {
    color: '#10b981',
  },
  dayTaskDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  dayTaskDotSelected: {
    backgroundColor: '#ffffff',
  },
  dayTaskCount: {
    position: 'absolute',
    top: 2,
    right: 2,
    fontSize: 10,
    color: '#10b981',
    fontWeight: '700',
  },

  currentDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginLeft: 8,
  },
  tasksCountBadge: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  tasksCountText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  todayButton: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  todayButtonText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 14,
  },

  tasksContainer: {
    flex: 1,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 300,
  },

  timelineContainer: {
    padding: 18,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineTime: {
    width: 70,
    alignItems: 'flex-end',
    paddingRight: 12,
    paddingTop: 4,
  },
  timelineHour: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  timelineDuration: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  timelineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  taskTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  taskTypeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  taskStatusRow: {
    flexDirection: 'row',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timelineClient: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  timelineAddress: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  timelineFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientPhone: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 6,
  },
  detailsButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  detailsButtonActive: {
    backgroundColor: '#3b82f6',
  },
  detailsButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  detailsButtonTextActive: {
    fontWeight: '700',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  notesText: {
    fontSize: 12,
    color: '#92400e',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },

  // Modal styles
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },

  // Task header in modal
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  taskIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  taskTitleContainer: {
    flex: 1,
  },
  modalTaskTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  statusBadgeModal: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextModal: {
    fontSize: 12,
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
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  locationText: {
    fontSize: 12,
    color: '#3b82f6',
    marginLeft: 8,
  },

  // Time section
  timeInfo: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Priority
  priorityBadgeModal: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  priorityTextModal: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Description
  descriptionText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
  },

  // Notes
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  notesText: {
    fontSize: 14,
    color: '#92400e',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },

  // Action buttons
  actionButtons: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  completeVisitButton: {
    backgroundColor: '#10b981',
  },
  completeVisitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
  },
  confirmButtonText: {
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

  bottomNav: {
    height: 72,
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
  },
  navBtn: { 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 4,
  },
  navBtnText: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
});