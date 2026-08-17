import * as Application from 'expo-application';

const RELEASES_URL = 'https://api.github.com/repos/Mikasita25/Lulu-Finity/releases';
const MOBILE_TAG_PREFIX = 'mobile-v';

export type MobileUpdate = {
  currentVersion: string;
  currentBuild: string;
  latestVersion: string;
  available: boolean;
  releaseName: string;
  notes: string;
  publishedAt?: string;
  downloadUrl?: string;
  releaseUrl?: string;
};

type GithubAsset = { name?: string; browser_download_url?: string };
type GithubRelease = {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: GithubAsset[];
};

function parseVersion(value: string) {
  return value
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function compareVersions(a: string, b: string) {
  const aa = parseVersion(a);
  const bb = parseVersion(b);
  for (let index = 0; index < 3; index += 1) {
    if ((aa[index] ?? 0) > (bb[index] ?? 0)) return 1;
    if ((aa[index] ?? 0) < (bb[index] ?? 0)) return -1;
  }
  return 0;
}

export function currentMobileVersion() {
  return Application.nativeApplicationVersion || '1.0.0';
}

export function currentMobileBuild() {
  return Application.nativeBuildVersion || '1';
}

export async function checkForMobileUpdate(): Promise<MobileUpdate> {
  const currentVersion = currentMobileVersion();
  const currentBuild = currentMobileBuild();
  // Pedimos hasta 100 releases y evitamos reutilizar una respuesta HTTP cacheada.
  // Así las releases de Windows no pueden desplazar fácilmente a las móviles fuera
  // de la primera página y una publicación recién creada aparece en la siguiente revisión.
  const response = await fetch(`${RELEASES_URL}?per_page=100&_=${Date.now()}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Cache-Control': 'no-cache',
    },
  });
  if (!response.ok) throw new Error(`GitHub respondió ${response.status} al buscar actualizaciones.`);

  const releases = (await response.json()) as GithubRelease[];
  const mobileReleases = releases
    .filter((release) => !release.draft && !release.prerelease && release.tag_name?.startsWith(MOBILE_TAG_PREFIX))
    .map((release) => ({
      release,
      version: release.tag_name!.slice(MOBILE_TAG_PREFIX.length),
    }))
    .sort((a, b) => compareVersions(b.version, a.version));

  const latest = mobileReleases[0];
  if (!latest) {
    return {
      currentVersion,
      currentBuild,
      latestVersion: currentVersion,
      available: false,
      releaseName: 'Lulú Finity Mobile',
      notes: 'Todavía no hay un release móvil publicado.',
    };
  }

  const apk = latest.release.assets?.find((asset) => {
    const name = asset.name?.toLowerCase() ?? '';
    return name.includes('lulu-finity-mobile-android') && name.endsWith('.apk');
  });

  return {
    currentVersion,
    currentBuild,
    latestVersion: latest.version,
    available: compareVersions(latest.version, currentVersion) > 0,
    releaseName: latest.release.name || `Lulú Finity Mobile ${latest.version}`,
    notes: latest.release.body?.trim() || 'Actualización de Lulú Finity Mobile.',
    publishedAt: latest.release.published_at,
    downloadUrl: apk?.browser_download_url,
    releaseUrl: latest.release.html_url,
  };
}
