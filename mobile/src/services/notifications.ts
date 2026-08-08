import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { LiveEvent } from '@/types/live';

let configured = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configureNotifications() {
  if (configured) return;
  configured = true;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('lulu-live', {
      name: 'Eventos importantes del LIVE',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 120, 70, 150],
      lightColor: '#FF5FC8',
      sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) {
    await Notifications.requestPermissionsAsync();
  }
}

export async function notifyImportantEvent(event: LiveEvent) {
  // Si la app está activa, la propia UI ya muestra la microinteracción.
  if (AppState.currentState === 'active') return;

  const content =
    event.type === 'gift'
      ? {
          title: '🎁 Nuevo regalo',
          body: `${event.nickname} envió ${event.giftName ?? 'un regalo'}${(event.repeatCount ?? 1) > 1 ? ` ×${event.repeatCount}` : ''}`,
        }
      : event.type === 'follow'
        ? { title: '💗 Nuevo seguidor', body: `${event.nickname} comenzó a seguirte.` }
        : event.type === 'subscribe'
          ? { title: '⭐ Nueva suscripción', body: `${event.nickname} se suscribió al LIVE.` }
          : null;

  if (!content) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      ...content,
      sound: 'default',
      color: '#FF5FC8',
      data: { liveEventId: event.id, type: event.type },
    },
    trigger: Platform.OS === 'android' ? { channelId: 'lulu-live' } : null,
  });
}

export async function notifyGoalCompleted(title: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🎉 ¡Meta completada!',
      body: title,
      sound: 'default',
      color: '#FF5FC8',
    },
    trigger: Platform.OS === 'android' ? { channelId: 'lulu-live' } : null,
  });
}
