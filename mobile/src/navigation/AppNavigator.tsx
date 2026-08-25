import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AudioLines, House, Music2, Settings, Zap } from 'lucide-react-native';
import { DashboardScreen } from '@/screens/DashboardScreen';
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
import { MusicScreen } from '@/screens/MusicScreen';
import { YouTubeBrowserScreen } from '@/screens/YouTubeBrowserScreen';
import { RecentActivityScreen } from '@/screens/RecentActivityScreen';
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
  if (route === 'Dashboard') return <House {...props} />;
  if (route === 'TTS') return <AudioLines {...props} />;
  if (route === 'Music') return <Music2 {...props} />;
  if (route === 'Interactions') return <Zap {...props} />;
  return <Settings {...props} />;
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
      tabBarLabelStyle: { fontSize: 10, fontWeight: '800', marginBottom: 8 },
      tabBarStyle: { position: 'absolute', height: 76, paddingTop: 9, backgroundColor: '#151019FA', borderTopColor: 'rgba(255,255,255,0.08)', elevation: 14 },
      tabBarIcon: ({ color, size }) => <TabIcon route={route.name} color={color} size={size} />,
    })}>
      <Tabs.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Inicio' }} />
      <Tabs.Screen name="TTS" component={TtsScreen} options={{ title: 'Voz' }} />
      <Tabs.Screen name="Music" component={MusicScreen} options={{ title: 'Música' }} />
      <Tabs.Screen name="Interactions" component={InteractionsScreen} options={{ title: 'Automatiza' }} />
      <Tabs.Screen name="More" component={MoreScreen} options={{ title: 'Ajustes' }} />
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
        <Stack.Screen name="YouTubeBrowser" component={YouTubeBrowserScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="RecentActivity" component={RecentActivityScreen} />
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
