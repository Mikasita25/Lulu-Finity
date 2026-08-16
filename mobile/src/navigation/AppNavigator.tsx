import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BarChart3, MoreHorizontal, Radio, Target, Trophy } from 'lucide-react-native';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { LiveViewScreen } from '@/screens/LiveViewScreen';
import { GoalsScreen } from '@/screens/GoalsScreen';
import { LeaderboardScreen } from '@/screens/LeaderboardScreen';
import { MoreScreen } from '@/screens/MoreScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { ConnectScreen } from '@/screens/ConnectScreen';
import { HistoryScreen } from '@/screens/HistoryScreen';
import { SoundsScreen } from '@/screens/SoundsScreen';
import { TtsScreen } from '@/screens/TtsScreen';
import { InteractionsScreen } from '@/screens/InteractionsScreen';
import { UpdatesScreen } from '@/screens/UpdatesScreen';
import { AppearanceScreen } from '@/screens/AppearanceScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { useAppStore } from '@/store/useAppStore';
import { accentByTheme } from '@/theme/palette';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function makeNavTheme(accent: string): Theme {
  return {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, primary: accent, background: '#09070D', card: '#100B13', border: 'rgba(255,255,255,0.08)', text: '#FFF7FC', notification: accent },
  };
}

function TabIcon({ route, color, size }: { route: string; color: string; size: number }) {
  const props = { color, size, strokeWidth: 2.4 };
  if (route === 'Dashboard') return <BarChart3 {...props} />;
  if (route === 'LiveView') return <Radio {...props} />;
  if (route === 'Goals') return <Target {...props} />;
  if (route === 'Leaderboard') return <Trophy {...props} />;
  return <MoreHorizontal {...props} />;
}

function MainTabs() {
  const accentTheme = useAppStore((state) => state.accentTheme);
  const accent = accentByTheme[accentTheme];
  return (
    <Tabs.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarShowLabel: true,
      tabBarActiveTintColor: accent,
      tabBarInactiveTintColor: '#786B76',
      tabBarLabelStyle: { fontSize: 10, fontWeight: '800', marginBottom: 6 },
      tabBarStyle: { position: 'absolute', height: 72, paddingTop: 8, backgroundColor: '#120D15F5', borderTopColor: 'rgba(255,255,255,0.08)', elevation: 14 },
      tabBarIcon: ({ color, size }) => <TabIcon route={route.name} color={color} size={size} />,
    })}>
      <Tabs.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Inicio' }} />
      <Tabs.Screen name="LiveView" component={LiveViewScreen} options={{ title: 'En Vivo' }} />
      <Tabs.Screen name="Goals" component={GoalsScreen} options={{ title: 'Metas' }} />
      <Tabs.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Ranking' }} />
      <Tabs.Screen name="More" component={MoreScreen} options={{ title: 'Más' }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const onboardingDone = useAppStore((state) => state.onboardingDone);
  const accentTheme = useAppStore((state) => state.accentTheme);
  const accent = accentByTheme[accentTheme];
  const initial = !onboardingDone ? 'Onboarding' : 'Main';

  return (
    <NavigationContainer theme={makeNavTheme(accent)}>
      <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#09070D' }, animation: 'slide_from_right' }}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Connect" component={ConnectScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="TTS" component={TtsScreen} />
        <Stack.Screen name="Interactions" component={InteractionsScreen} />
        <Stack.Screen name="Updates" component={UpdatesScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Sounds" component={SoundsScreen} />
        <Stack.Screen name="Appearance" component={AppearanceScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
