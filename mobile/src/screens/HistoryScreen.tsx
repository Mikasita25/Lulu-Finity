import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { History, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { EventRow } from '@/components/EventRow';
import { Button } from '@/components/Button';
import { useAppStore } from '@/store/useAppStore';
import type { LiveEventType } from '@/types/live';

type Filter = 'all' | LiveEventType;

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'gift', label: 'Regalos' },
  { id: 'comment', label: 'Chat' },
  { id: 'fanSticker', label: 'Fan Stickers' },
  { id: 'like', label: 'Likes' },
  { id: 'follow', label: 'Follow' },
  { id: 'share', label: 'Share' },
  { id: 'member', label: 'Entradas' },
  { id: 'subscribe', label: 'Subs' },
];

export function HistoryScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const events = useAppStore((state) => state.events);
  const clearHistory = useAppStore((state) => state.clearHistory);
  const filtered = useMemo(
    () => (filter === 'all' ? events : events.filter((event) => event.type === filter)),
    [events, filter],
  );

  return (
    <Screen>
      <AppHeader title="Historial" subtitle="Hasta 500 eventos persistidos en el dispositivo." />
      <View className="mb-4 flex-row flex-wrap gap-2">
        {filters.map((item) => (
          <Text
            key={item.id}
            onPress={() => setFilter(item.id)}
            className={`overflow-hidden rounded-xl px-3 py-2.5 text-xs font-black ${
              filter === item.id ? 'bg-lulu-500 text-white' : 'bg-white/[0.06] text-white/40'
            }`}
          >
            {item.label}
          </Text>
        ))}
      </View>
      <GlassCard>
        <View className="px-4">
          {filtered.map((event) => <EventRow key={event.id} event={event} />)}
          {!filtered.length ? (
            <View className="items-center py-12">
              <History size={30} color="#685D67" />
              <Text className="mt-3 text-sm font-bold text-white/30">No hay eventos con este filtro.</Text>
            </View>
          ) : null}
        </View>
      </GlassCard>
      {events.length ? (
        <View className="mt-4">
          <Button label="Borrar historial" variant="danger" onPress={clearHistory} icon={<Trash2 size={17} color="#FDA4AF" />} />
        </View>
      ) : null}
    </Screen>
  );
}
