import {
  NavigationContainer,
  DarkTheme,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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
import { BottomNavigation } from '@/components/BottomNavigation';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function makeNavTheme(accent: string): Theme {
  return {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: accent,
      background: '#0D1026',
      card: '#151936',
      border: 'rgba(222,207,255,0.14)',
      text: '#F7F3FF',
      notification: accent,
    },
  };
}

function MainTabs() {
  return (
    <Tabs.Navigator
      tabBar={(props) => <BottomNavigation {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Inicio' }}
      />
      <Tabs.Screen
        name="TTS"
        component={TtsScreen}
        options={{ title: 'Voz' }}
      />
      <Tabs.Screen
        name="Music"
        component={MusicScreen}
        options={{ title: 'Música' }}
      />
      <Tabs.Screen
        name="Interactions"
        component={InteractionsScreen}
        options={{ title: 'Automatiza' }}
      />
      <Tabs.Screen
        name="More"
        component={MoreScreen}
        options={{ title: 'Ajustes' }}
      />
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
      <Stack.Navigator
        initialRouteName={initial}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0D1026' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Connect" component={ConnectScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="YouTubeBrowser"
          component={YouTubeBrowserScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
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
