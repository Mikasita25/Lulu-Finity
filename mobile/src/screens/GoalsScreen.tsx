import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { Plus, Sparkles } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { GoalCard } from '@/components/GoalCard';
import { SectionTitle } from '@/components/SectionTitle';
import { useAppStore } from '@/store/useAppStore';
import type { GoalKind } from '@/types/live';

const kinds: { id: GoalKind; label: string }[] = [
  { id: 'likes', label: 'Likes' },
  { id: 'diamonds', label: 'Diamantes' },
  { id: 'gifts', label: 'Regalos' },
  { id: 'followers', label: 'Follows' },
  { id: 'shares', label: 'Shares' },
  { id: 'viewers', label: 'Viewers' },
];

export function GoalsScreen() {
  const mode = useAppStore((state) => state.mode);
  const goals = useAppStore((state) => state.goals);
  const stats = useAppStore((state) => state.stats);
  const addGoal = useAppStore((state) => state.addGoal);
  const [kind, setKind] = useState<GoalKind>('likes');
  const [title, setTitle] = useState('Meta del LIVE');
  const [target, setTarget] = useState('1000');

  const create = () => {
    const numeric = Math.max(1, Math.round(Number(target)));
    if (!Number.isFinite(numeric)) return Alert.alert('Objetivo inválido', 'Escribe un número válido.');
    addGoal({ title: title.trim() || 'Meta del LIVE', kind, target: numeric, enabled: true });
    setTitle('Meta del LIVE');
  };

  return (
    <Screen>
      <AppHeader title="Metas" subtitle="Progreso animado en tiempo real." />

      {mode === 'streamer' ? (
        <GlassCard>
          <View className="p-5">
            <View className="mb-4 flex-row items-center gap-2">
              <Sparkles size={18} color="#FF9DDA" />
              <Text className="text-base font-black text-white">Nueva meta</Text>
            </View>

            <Text className="mb-2 text-xs font-black uppercase tracking-[1.5px] text-white/40">Título</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Meta del LIVE"
              placeholderTextColor="#766A74"
              className="h-14 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm font-bold text-white"
            />

            <Text className="mb-2 mt-5 text-xs font-black uppercase tracking-[1.5px] text-white/40">
              Tipo
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {kinds.map((item) => (
                <Text
                  key={item.id}
                  onPress={() => setKind(item.id)}
                  className={`overflow-hidden rounded-xl px-3 py-2.5 text-xs font-black ${
                    kind === item.id ? 'bg-lulu-500 text-white' : 'bg-white/[0.07] text-white/40'
                  }`}
                >
                  {item.label}
                </Text>
              ))}
            </View>

            <Text className="mb-2 mt-5 text-xs font-black uppercase tracking-[1.5px] text-white/40">
              Objetivo
            </Text>
            <TextInput
              value={target}
              onChangeText={setTarget}
              keyboardType="number-pad"
              placeholder="1000"
              placeholderTextColor="#766A74"
              className="h-14 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm font-bold text-white"
            />

            <View className="mt-5">
              <Button label="Crear meta" onPress={create} icon={<Plus size={18} color="white" />} />
            </View>
          </View>
        </GlassCard>
      ) : (
        <GlassCard>
          <Text className="p-5 text-sm leading-6 text-white/50">
            Estás en modo Espectador. Puedes seguir el progreso, pero solo el Streamer puede crear o editar metas.
          </Text>
        </GlassCard>
      )}

      <SectionTitle
        title="Metas activas"
        subtitle={goals.length ? `${goals.length} configurada${goals.length === 1 ? '' : 's'}` : 'Crea tu primera meta.'}
      />
      {goals.length ? (
        goals.map((goal) => <GoalCard key={goal.id} goal={goal} stats={stats} readonly={mode === 'spectator'} />)
      ) : (
        <GlassCard>
          <View className="items-center px-5 py-10">
            <Sparkles size={30} color="#6F6170" />
            <Text className="mt-3 text-sm font-bold text-white/40">Aún no hay metas.</Text>
          </View>
        </GlassCard>
      )}
    </Screen>
  );
}
