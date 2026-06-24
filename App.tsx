// GA-Mobil/App.tsx
import React, { useState, useEffect } from 'react';
import { StatusBar, TouchableOpacity, View, Text, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

// Ekranlarımız
import LoginScreen from './src/screens/LoginScreen';
import WorkOrdersScreen from './src/screens/WorkOrdersScreen';
import MapScreen from './src/screens/MapScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// (İleride doldurulacak boş ekranlar)
const PlaceholderScreen = ({ name }: { name: string }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>{name} Ekranı Yapım Aşamasında</Text></View>
);

const Tab = createBottomTabNavigator();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    const token = await SecureStore.getItemAsync('user_id');
    setIsAuthenticated(!!token);
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('user_id');
    setIsAuthenticated(false);
  };

  if (isAuthenticated === null) return null; // Yükleniyor ekranı

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#1A233A" />
      {!isAuthenticated ? (
        <LoginScreen onLoginSuccess={checkLoginStatus} />
      ) : (
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName: any = 'list';
              if (route.name === 'İş Emirleri') iconName = focused ? 'clipboard' : 'clipboard-outline';
              else if (route.name === 'Harita') iconName = focused ? 'map' : 'map-outline';
              else if (route.name === 'Genel Bakış') iconName = focused ? 'grid' : 'grid-outline';
              else if (route.name === 'Sohbet') iconName = focused ? 'chatbubble' : 'chatbubble-outline';
              else if (route.name === 'Profil') iconName = focused ? 'person' : 'person-outline';
              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#F97316', // Brand Orange
            tabBarInactiveTintColor: '#94A3B8',
            tabBarStyle: { backgroundColor: '#1A233A', borderTopWidth: 0, paddingBottom: 5, height: 60 },
            headerStyle: { backgroundColor: '#1A233A', elevation: 0, shadowOpacity: 0 },
            headerTintColor: '#fff',
            // 🚀 TEAMER TARZI ÖZEL ÜST BİLGİ (HEADER)
            headerTitle: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image 
                  source={require('./assets/logo.png')} 
                  style={{ width: 32, height: 32, marginRight: 10 }} 
                  resizeMode="contain" 
                />
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 }}>GÖREV ADAMI</Text>
              </View>
            ),
            headerRight: () => (
              <View style={{ flexDirection: 'row', marginRight: 15, alignItems: 'center' }}>
                <TouchableOpacity style={{ marginRight: 20 }}>
                  <Ionicons name="notifications-outline" size={24} color="#fff" />
                  <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: 'red', width: 10, height: 10, borderRadius: 5 }} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleLogout}>
                  <Ionicons name="power-outline" size={26} color="#fff" />
                </TouchableOpacity>
              </View>
            ),
          })}
        >
          <Tab.Screen name="İş Emirleri" component={WorkOrdersScreen} />
          <Tab.Screen name="Harita" component={MapScreen} />
          <Tab.Screen name="Genel Bakış">{(props) => <PlaceholderScreen name="Genel Bakış" />}</Tab.Screen>
          <Tab.Screen name="Sohbet">{(props) => <PlaceholderScreen name="Sohbet" />}</Tab.Screen>
          <Tab.Screen name="Profil" component={ProfileScreen} />
        </Tab.Navigator>
      )}
    </NavigationContainer>
  );
}