function runtimeProcessUsage() {
  const metrics = app.getAppMetrics();
  const privateAvailable = metrics.length > 0
    && metrics.every(metric => Number.isFinite(metric.memory?.privateWorkingSetSize));
  const field = privateAvailable ? 'privateWorkingSetSize' : 'workingSetSize';
  const names = {
    Desktop: 'Núcleo de Rust',
    Backend: 'Motor de voz y conexiones',
    WebView2: 'WebView2 (interfaz, reproductores y gráficos)',
    Helper: 'Servicios auxiliares'
  };
  const totals = new Map();
  let totalKb = 0;
  let residentKb = 0;
  for (const metric of metrics) {
    const resident = Number(metric.memory?.workingSetSize) || 0;
    const memory = Number(metric.memory?.[field]) || 0;
    const role = names[metric.type] || 'Otros procesos';
    totalKb += memory;
    residentKb += resident;
    totals.set(role, (totals.get(role) || 0) + memory);
  }
  return {
    totalMemoryMb: Math.round(totalKb / 1024),
    privateMemoryMb: privateAvailable ? Math.round(totalKb / 1024) : null,
    residentMemoryMb: Math.round(residentKb / 1024),
    memoryKind: privateAvailable ? 'private' : 'resident',
    mainMemoryMb: Math.round((totals.get(names.Desktop) || 0) / 1024),
    processes: metrics.length,
    breakdown: [...totals].map(([label, kb]) => ({ label, memoryMb: Math.round(kb / 1024) }))
      .filter(item => item.memoryMb > 0)
      .sort((a, b) => b.memoryMb - a.memoryMb)
  };
}
