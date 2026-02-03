import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { supabase } from '../src/lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Wallet: undefined;
  Calendrier: undefined;
};

export default function WalletScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [walletData, setWalletData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Vérification de l'authentification COMME DANS CalendrierScreen
  const checkAuth = async (): Promise<boolean> => {
    try {
      // Même logique que CalendrierScreen
      const userData = await AsyncStorage.getItem('userData');
      if (!userData) {
        console.log('Pas de userData - Redirection Login');
        return false;
      }
      
      // Vérifier que les données sont valides
      const user = JSON.parse(userData);
      if (!user || !user.id) {
        console.log('Données utilisateur invalides');
        await AsyncStorage.removeItem('userData');
        return false;
      }
      
      console.log('✅ Utilisateur authentifié:', user.nom);
      return true;
    } catch (err) {
      console.error('Auth check error:', err);
      return false;
    }
  };

  // Récupération des données du wallet avec fallback
  const fetchWalletData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Même méthode que CalendrierScreen
      const userData = await AsyncStorage.getItem('userData');
      console.log('Wallet - Données AsyncStorage:', userData ? 'Oui' : 'Non');
      
      if (!userData) {
        console.log('❌ Wallet: Pas de userData - Redirection Login');
        navigation.navigate('Login');
        return;
      }

      const user = JSON.parse(userData);
      console.log('Wallet - Utilisateur:', { id: user.id, nom: user.nom });

      const employee_id = user.id;

      // Essayer de récupérer le wallet
      const { data, error } = await supabase
        .from('wallet')
        .select('*')
        .eq('employee_id', employee_id)
        .single();

      console.log('Wallet - Résultat:', data ? 'Oui' : 'Non');
      console.log('Wallet - Erreur:', error);

      if (error) {
        // Si table n'existe pas ou pas de données
        if (error.code === '42P01' || error.code === 'PGRST116') {
          console.log('Table wallet non trouvée ou vide, création données de test');
          setWalletData(createMockWalletData(user));
        } else {
          console.log('Supabase error:', error);
          setError('Impossible de récupérer le wallet');
          setWalletData(createMockWalletData(user)); // Données de test en fallback
        }
        return;
      }

      // Traiter les données réelles
      if (data) {
        console.log('✅ Wallet récupéré avec succès');
        processWalletData(data, user);
      } else {
        console.log('⚠️ Pas de données wallet, création mock');
        setWalletData(createMockWalletData(user));
      }
      
    } catch (err) {
      console.error('💥 Erreur fetchWalletData:', err);
      setError('Erreur de connexion');
      
      // Fallback aux données mock
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        setWalletData(createMockWalletData(user));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fonction pour traiter les données du wallet
  const processWalletData = (data: any, user: any) => {
    const walletData = {
      wallet: {
        ...data,
        total_formatted: data.total ? `${Number(data.total).toFixed(2)}€` : '0,00€'
      },
      employee: {
        id: user.id,
        email: user.email || '',
        nom: user.nom || 'Utilisateur',
      },
      transactions: data.transactions || getMockTransactions(),
      stats: {
        solde: data.total ? `${Number(data.total).toFixed(2)}€` : '0,00€',
        enAttente: data.stats?.enAttente || '0,00€',
        ceMois: data.stats?.ceMois || '0,00€'
      },
      last_updated: data.updated_at || new Date().toISOString(),
    };
    
    console.log('Wallet data traité:', walletData);
    setWalletData(walletData);
  };

  // Données mock pour le wallet
  const createMockWalletData = (user: any) => {
    console.log('Création mock wallet pour:', user.nom);
    
    const mockTransactions = getMockTransactions();
    const total = mockTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    return {
      wallet: {
        id: 'mock-1',
        employee_id: user.id,
        total: total,
        total_formatted: `${total.toFixed(2)}€`,
        stats: {
          enAttente: '50,00€',
          ceMois: `${total.toFixed(2)}€`
        },
        transactions: mockTransactions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      employee: {
        id: user.id,
        email: user.email || '',
        nom: user.nom || 'Utilisateur',
      },
      transactions: mockTransactions,
      stats: {
        solde: `${total.toFixed(2)}€`,
        enAttente: '50,00€',
        ceMois: `${total.toFixed(2)}€`
      },
      last_updated: new Date().toISOString(),
    };
  };

  // Transactions mock
  const getMockTransactions = () => {
    return [
      {
        id: '1',
        title: 'Nettoyage bureau',
        amount: '120.50',
        amount_formatted: '120,50€',
        date: '2024-01-25',
        status: 'payé',
        icon: 'broom'
      },
      {
        id: '2',
        title: 'Désinfection appartement',
        amount: '85.00',
        amount_formatted: '85,00€',
        date: '2024-01-24',
        status: 'payé',
        icon: 'spray'
      },
      {
        id: '3',
        title: 'Nettoyage vitres',
        amount: '60.00',
        amount_formatted: '60,00€',
        date: '2024-01-23',
        status: 'en attente',
        icon: 'window-open'
      },
      {
        id: '4',
        title: 'Nettoyage voiture',
        amount: '45.00',
        amount_formatted: '45,00€',
        date: '2024-01-22',
        status: 'payé',
        icon: 'car-wash'
      }
    ];
  };

  // Initialisation
  useEffect(() => {
    const initialize = async () => {
      const isAuthenticated = await checkAuth();
      console.log('Wallet - Auth check:', isAuthenticated);
      
      if (isAuthenticated) {
        await fetchWalletData();
      } else {
        console.log('❌ Wallet: Non authentifié, redirection Login');
        navigation.navigate('Login');
      }
    };
    initialize();
  }, []);

  // Recharger quand l'écran redevient actif
  useFocusEffect(
    React.useCallback(() => {
      console.log('Wallet - useFocusEffect');
      fetchWalletData();
    }, [])
  );

  const onRefresh = () => {
    console.log('Wallet - onRefresh');
    setRefreshing(true);
    fetchWalletData();
  };

  // Affichage des états de chargement / erreur
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Chargement du portefeuille...</Text>
      </View>
    );
  }

  if (error && !walletData) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchWalletData}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: '#6b7280', marginTop: 12 }]} 
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.retryButtonText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!walletData) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="wallet-outline" size={64} color="#9ca3af" />
        <Text style={styles.errorText}>Aucune donnée disponible</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchWalletData}>
          <Text style={styles.retryButtonText}>Charger les données</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { wallet, employee, transactions, stats, last_updated } = walletData;

  return (
    <View style={styles.container}>
      <View style={styles.statusBar} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {employee.nom && <Text style={styles.headerSubtitle}>Bienvenue,{employee.nom}</Text>}
        </View>
        <TouchableOpacity style={styles.notificationBtn} onPress={fetchWalletData}>
          <MaterialCommunityIcons name="refresh" size={24} color="#10b981" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10b981']} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Carte solde */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceAmount}>{stats.solde}</Text>
            <TouchableOpacity onPress={fetchWalletData}>
              <MaterialCommunityIcons name="refresh" size={20} color="#10b981" />
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceLabel}>Solde disponible</Text>
        </View>
        {/* Dernière mise à jour */}
        {last_updated && (
          <View style={styles.updateInfo}>
            <MaterialCommunityIcons name="information-outline" size={14} color="#9ca3af" />
            <Text style={styles.updateText}>
              Dernière mise à jour: {new Date(last_updated).toLocaleTimeString('fr-FR')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Navigation bas */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navBtn} 
          onPress={() => navigation.navigate('Home')}
        >
          <MaterialCommunityIcons name="map" size={20} color="#6b7280" />
          <Text style={styles.navBtnText}>Carte</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navBtn}
          onPress={() => navigation.navigate('Calendrier')}
        >
          <MaterialCommunityIcons name="calendar" size={20} color="#6b7280" />
          <Text style={styles.navBtnText}>Mon agenda</Text> 
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn}>
          <MaterialCommunityIcons name="wallet" size={20} color="#10b981" />
          <Text style={[styles.navBtnText, { color: '#10b981' }]}>Portefeuille</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Styles avec ajouts
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
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
  errorContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#f9fafb', 
    padding: 20 
  },
  errorText: { 
    marginTop: 16, 
    fontSize: 16, 
    color: '#374151', 
    textAlign: 'center', 
    marginBottom: 24 
  },
  retryButton: { 
    backgroundColor: '#10b981', 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 8 
  },
  retryButtonText: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  scrollView: { flex: 1 },
  statusBar: { 
    height: Platform.OS === 'ios' ? 40 : 0, 
    backgroundColor: '#fff' 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#f3f4f6' 
  },
  headerLeft: { flex: 1 },
  headerTitle: { 
    fontSize: 28, 
    fontWeight: '700', 
    color: '#0f172a' 
  },
  headerSubtitle: { 
    fontSize: 14, 
    color: '#6b7280', 
    marginTop: 4 
  },
  notificationBtn: { padding: 8 },
  
  balanceCard: { 
    backgroundColor: '#fff', 
    marginHorizontal: 20, 
    marginTop: 20, 
    padding: 20, 
    borderRadius: 16, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 8, 
    elevation: 2 
  },
  balanceHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 8 
  },
  balanceAmount: { 
    fontSize: 36, 
    fontWeight: '700', 
    color: '#0f172a' 
  },
  balanceLabel: { 
    fontSize: 14, 
    color: '#6b7280', 
    marginBottom: 4 
  },
  balanceNote: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#f3f4f6',
  },
  
  transactionSection: { 
    paddingHorizontal: 20, 
    paddingBottom: 20, 
    marginTop: 20 
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#374151' 
  },
  transactionCount: { 
    fontSize: 14, 
    color: '#9ca3af' 
  },
  transactionCard: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12, 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 4, 
    elevation: 1 
  },
  transactionIcon: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: '#ecfdf5', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12 
  },
  transactionInfo: { flex: 1 },
  transactionTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#0f172a' 
  },
  transactionDate: { 
    fontSize: 12, 
    color: '#9ca3af', 
    marginTop: 2 
  },
  transactionAmount: { alignItems: 'flex-end' },
  transactionAmountText: { fontSize: 16, fontWeight: '700' },
  amountPositive: { color: '#10b981' },
  amountPending: { color: '#0f172a' },
  statusBadgeInline: { 
    alignSelf: 'flex-start', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 10, 
    marginTop: 4 
  },
  statusTextInline: { 
    fontSize: 10, 
    fontWeight: '600', 
    color: '#374151' 
  },
  statusPaid: { backgroundColor: '#ecfdf5' },
  statusPending: { backgroundColor: '#fef3c7' },
  emptyState: { 
    alignItems: 'center', 
    padding: 40, 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    marginTop: 10 
  },
  emptyStateText: { 
    marginTop: 16, 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#374151' 
  },
  emptyStateSubtext: { 
    marginTop: 8, 
    fontSize: 14, 
    color: '#6b7280', 
    textAlign: 'center' 
  },
  updateInfo: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingVertical: 8 
  },
  updateText: { 
    fontSize: 12, 
    color: '#9ca3af', 
    marginLeft: 4 
  },
  bottomNav: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingVertical: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#e5e7eb', 
    backgroundColor: '#fff' 
  },
  navBtn: { alignItems: 'center' },
  navBtnText: { 
    fontSize: 10, 
    color: '#6b7280', 
    marginTop: 2 
  },
});