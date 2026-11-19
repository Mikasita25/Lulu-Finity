import { adsLists } from '@ghostery/adblocker';

export class ElectronBlocker {
  static async fromPrebuiltAdsOnly(fetcher, caching) {
    let lists;
    try {
      const cached = JSON.parse(await caching.read(caching.path + '.tauri.json'));
      if (Date.now() - cached.time < 7 * 24 * 60 * 60 * 1000) lists = cached.lists;
    } catch {}
    if (!lists) {
      const fetched = await Promise.allSettled(adsLists.map(async url => {
        const response = await fetcher(url, { signal: AbortSignal.timeout(12_000) });
        if (!response.ok) throw new Error(`Filtros de YouTube: HTTP ${response.status}.`);
        return response.text();
      }));
      lists = fetched.filter(result => result.status === 'fulfilled').map(result => result.value).join('\n');
      if (!lists) throw new Error('No se pudieron descargar las listas de filtros.');
      if (fetched.every(result => result.status === 'fulfilled')) {
        await caching.write(caching.path + '.tauri.json', JSON.stringify({ time: Date.now(), lists })).catch(console.warn);
      }
    }
    return new ElectronBlocker(lists);
  }

  constructor(lists) { this.lists = lists; }
  enableBlockingInSession(session) { return session.setAdvancedFilters(this.lists); }
  disableBlockingInSession(session) { return session.setAdvancedFilters(''); }
}
