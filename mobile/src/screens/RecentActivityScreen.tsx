import { Pressable, Switch, Text, View } from 'react-native';
import { Eye, EyeOff, SlidersHorizontal } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { SectionTitle } from '@/components/SectionTitle';
import { EventRow } from '@/components/EventRow';
import { useAppStore } from '@/store/useAppStore';
import { filterRecentEvents, useMobileControlStore } from '@/store/useMobileControlStore';
import type { LiveEventType } from '@/types/live';

const FILTERS: Array<{ type: LiveEventType; label: string; subtitle: string }> = [
  { type: 'comment', label: 'Comentarios', subtitle: 'Mensajes normales del chat' },
  { type: 'gift', label: 'Regalos', subtitle: 'Regalos y repeticiones' },
  { type: 'follow', label: 'Nuevos seguidores', subtitle: 'Usuarios que empezaron a seguir' },
  { type: 'share', label: 'Compartidos', subtitle: 'Usuarios que compartieron el LIVE' },
  { type: 'subscribe', label: 'Suscripciones', subtitle: 'Nuevas suscripciones del LIVE' },
  { type: 'fanSticker', label: 'Fan Stickers', subtitle: 'Stickers de Fan y Super Fan' },
  { type: 'like', label: 'Likes', subtitle: 'Eventos de likes; pueden ser muy frecuentes' },
  { type: 'member', label: 'Entradas al LIVE', subtitle: 'Entradas y cambios de audiencia' },
];

export function RecentActivityScreen() {
  const events = useAppStore((state) => state.events);
  const filters = useMobileControlStore((state) => state.recentFilters);
  const maxItems = useMobileControlStore((state) => state.recentMaxItems);
  const setFilter = useMobileControlStore((state) => state.setRecentFilter);
  const setAll = useMobileControlStore((state) => state.setAllRecentFilters);
  const setMaxItems = useMobileControlStore((state) => state.setRecentMaxItems);
  const visible = filterRecentEvents(events, filters, maxItems);
  const enabledCount = FILTERS.filter((item) => filters[item.type]).length;

  return (
    <Screen>
      <AppHeader
        title="Actividad reciente"
        subtitle="Elige exactamente qué quieres ver durante el LIVE."
      />

      <GlassCard>
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-lulu-500/10">
              <SlidersHorizontal size={19} color="#FF9DDA" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-black text-white">{enabledCount} tipos activos</Text>
              <Text className="mt-1 text-xs leading-5 text-white/40">
                Estos filtros también se aplican a la Vista en Vivo.
              </Text>
            </View>
          </View>
          <View className="mt-4 flex-row gap-2">
            <Pressable onPress={() => setAll(true)} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-lulu-500/15 px-3 py-3">
              <Eye size={16} color="#FF9DDA" />
              <Text className="text-xs font-black text-lulu-200">Mostrar todo</Text>
            </Pressable>
            <Pressable onPress={() => setAll(false)} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-3 py-3">
              <EyeOff size={16} color="#B7A9B4" />
              <Text className="text-xs font-black text-white/55">Ocultar todo</Text>
            </Pressable>
          </View>
        </View>
      </GlassCard>

      <SectionTitle title="Qué aparece" />
      <GlassCard>
        <View className="px-5">
          {FILTERS.map((item) => (
            <View key={item.type} className="flex-row items-center gap-3 border-b border-white/[0.055] py-4">
              <View className="flex-1">
                <Text className="text-sm font-black text-white">{item.label}</Text>
                <Text className="mt-1 text-xs leading-5 text-white/40">{item.subtitle}</Text>
              </View>
              <Switch
                value={filters[item.type]}
                onValueChange={(value) => setFilter(item.type, value)}
                trackColor={{ false: '#342C34', true: '#FF5FC8' }}
                thumbColor="#FFF7FC"
              />
            </View>
          ))}
        </View>
      </GlassCard>

      <SectionTitle title="Cantidad visible" />
      <View className="mb-2 flex-row gap-2">
        {[10, 25, 50].map((value) => (
          <Pressable
            key={value}
            onPress={() => setMaxItems(value)}
            className={`flex-1 rounded-2xl px-3 py-3 ${maxItems === value ? 'bg-lulu-500' : 'bg-white/[0.06]'}`}
          >
            <Text className={`text-center text-xs font-black ${maxItems === value ? 'text-white' : 'text-white/45'}`}>
              {value}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle title={`Vista previa · ${visible.length}`} />
      <GlassCard>
        <View className="px-5">
          {visible.slice(0, 12).map((event) => <EventRow key={event.id} event={event} />)}
          {!visible.length ? (
            <Text className="py-8 text-center text-xs font-semibold text-white/30">
              No hay eventos visibles con los filtros actuales.
            </Text>
          ) : null}
        </View>
      </GlassCard>
    </Screen>
  );
}
