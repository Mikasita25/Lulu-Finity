import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80) || `sound-${Date.now()}.mp3`;
}

export async function pickAndPersistSound() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['audio/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('Android no proporcionó un directorio privado para la app.');
  const directory = `${base}lulu-sounds/`;
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists) await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const target = `${directory}${Date.now()}-${safeName(asset.name)}`;
  await FileSystem.copyAsync({ from: asset.uri, to: target });
  return { uri: target, name: asset.name };
}
