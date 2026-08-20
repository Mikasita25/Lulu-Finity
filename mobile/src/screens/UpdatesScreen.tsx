import { Linking, Switch, Text, View } from 'react-native';
import { CheckCircle2, Download, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { useUpdateStore } from '@/store/useUpdateStore';
import { currentMobileBuild, currentMobileVersion } from '@/services/updates';

function dateLabel(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function checkedLabel(value: number) {
  if (!value) return 'Todavía no se ha comprobado en este dispositivo.';
  return `Última comprobación correcta: ${new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`;
}

export function UpdatesScreen() {
  const autoCheckEnabled = useUpdateStore((state) => state.autoCheckEnabled);
  const setAutoCheckEnabled = useUpdateStore((state) => state.setAutoCheckEnabled);
  const lastCheckedAt = useUpdateStore((state) => state.lastCheckedAt);
  const loading = useUpdateStore((state) => state.loading);
  const error = useUpdateStore((state) => state.error);
  const update = useUpdateStore((state) => state.update);
  const check = useUpdateStore((state) => state.check);
  const currentVersion = currentMobileVersion();
  const currentBuild = currentMobileBuild();

  const download = async () => {
    const url = update?.downloadUrl || update?.releaseUrl;
    if (url) await Linking.openURL(url);
  };

  const checkNow = async () => {
    await check(true);
  };

  return (
    <Screen>
      <AppHeader title="Actualizaciones" subtitle="Mantén Lulú Finity Mobile al día sin confundirla con la versión de PC." />

      <GlassCard className="mb-4">
        <View className="p-5">
          <Text className="text-[10px] font-black uppercase tracking-[1.6px] text-white/30">Versión instalada</Text>
          <Text className="mt-2 text-3xl font-black text-white">v{currentVersion}</Text>
          <Text className="mt-1 text-xs font-bold text-white/35">Android build {currentBuild}</Text>
          <View className="mt-4 rounded-2xl bg-white/[0.045] p-4">
            <View className="flex-row items-center gap-3">
              <ShieldCheck size={18} color="#FF9DDA" />
              <Text className="flex-1 text-xs leading-5 text-white/45">El actualizador solo acepta releases con etiqueta <Text className="font-black text-lulu-200">mobile-vX.Y.Z</Text>. Las versiones Windows de Lulú Finity se ignoran.</Text>
            </View>
          </View>
        </View>
      </GlassCard>

      <GlassCard className="mb-4">
        <View className="p-5">
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="text-sm font-black text-white">Buscar automáticamente</Text>
              <Text className="mt-1 text-xs leading-5 text-white/40">Al abrir la app revisa como máximo una vez cada 24 horas. Si encuentra una versión nueva, te muestra el aviso para descargarla.</Text>
            </View>
            <Switch value={autoCheckEnabled} onValueChange={setAutoCheckEnabled} trackColor={{ false: '#342C34', true: '#FF5FC8' }} thumbColor="#FFF7FC" />
          </View>
          <Text className="mt-3 text-[11px] leading-5 text-white/30">{checkedLabel(lastCheckedAt)}</Text>
          <Text className="mt-1 text-[11px] leading-5 text-white/25">Android siempre pedirá tu confirmación antes de instalar un APK nuevo.</Text>
        </View>
      </GlassCard>

      {update?.available ? (
        <GlassCard className="mb-4">
          <View className="p-5">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-lulu-500/20"><Download size={20} color="#FF9DDA" /></View>
              <View className="flex-1">
                <Text className="text-base font-black text-white">Nueva versión v{update.latestVersion}</Text>
                <Text className="mt-1 text-xs font-bold text-lulu-200">{update.releaseName}{update.publishedAt ? ` · ${dateLabel(update.publishedAt)}` : ''}</Text>
              </View>
            </View>
            <View className="mt-4 rounded-2xl bg-black/20 p-4"><Text className="text-xs leading-5 text-white/55">{update.notes}</Text></View>
            <View className="mt-4"><Button label={update.downloadUrl ? 'Descargar APK' : 'Abrir release'} onPress={download} icon={<Download size={17} color="white" />} /></View>
            <Text className="mt-3 text-[11px] leading-5 text-white/30">La descarga abre directamente el APK de la release móvil cuando está disponible.</Text>
          </View>
        </GlassCard>
      ) : update ? (
        <GlassCard className="mb-4">
          <View className="items-center p-6">
            <CheckCircle2 size={28} color="#5CE1A4" />
            <Text className="mt-3 text-base font-black text-white">Estás al día</Text>
            <Text className="mt-1 text-center text-xs leading-5 text-white/40">La versión móvil más reciente es v{update.latestVersion}.</Text>
          </View>
        </GlassCard>
      ) : null}

      {error ? <Text selectable className="mb-4 rounded-2xl bg-red-500/10 p-4 text-xs leading-5 text-red-200">{error}</Text> : null}
      <Button label={loading ? 'Buscando…' : 'Buscar actualización'} disabled={loading} onPress={checkNow} variant="secondary" icon={<RefreshCw size={17} color="white" />} />
    </Screen>
  );
}
