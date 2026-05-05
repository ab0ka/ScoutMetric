import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';

import PlayersScreen from './PlayersScreen';
import PlayerDetailScreen from './PlayerDetailScreen';
import MatchesScreen from './MatchesScreen';
import ProfileScreen from './ProfileScreen';

const Tab = createBottomTabNavigator();
const PlayersStack = createStackNavigator();

function PlayersStackNav() {
  return (
    <PlayersStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.bgCard, borderBottomColor: theme.border, borderBottomWidth: 1 },
        headerTintColor: theme.textPrimary,
        headerTitleStyle: { fontWeight: '700', fontSize: 16 },
      }}
    >
      <PlayersStack.Screen name="PlayersList" component={PlayersScreen} options={{ title: 'Игроки' }} />
      <PlayersStack.Screen name="PlayerDetail" component={PlayerDetailScreen}
        options={({ route }) => ({ title: route.params?.player?.name || 'Профиль' })} />
    </PlayersStack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: theme.bgCard, borderBottomColor: theme.border, borderBottomWidth: 1 },
          headerTintColor: theme.textPrimary,
          headerTitleStyle: { fontWeight: '700', fontSize: 16 },
          tabBarStyle: {
            backgroundColor: theme.bgCard,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            paddingBottom: 4,
          },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textMuted,
          tabBarIcon: ({ focused, color, size }) => {
            const icons = {
              Players: focused ? 'people' : 'people-outline',
              Matches: focused ? 'football' : 'football-outline',
              Profile: focused ? 'person' : 'person-outline',
            };
            return <Ionicons name={icons[route.name]} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Players" component={PlayersStackNav}
          options={{ headerShown: false, tabBarLabel: 'Игроки' }} />
        <Tab.Screen name="Matches" component={MatchesScreen}
          options={{ title: 'Матчи', tabBarLabel: 'Матчи' }} />
        <Tab.Screen name="Profile" component={ProfileScreen}
          options={{ title: 'Профиль', tabBarLabel: 'Профиль' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
