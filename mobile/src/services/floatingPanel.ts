import { NativeModule, requireNativeModule } from 'expo';

type FloatingPanelAction = {
  action: 'togglePause' | 'skip' | 'close' | string;
};

type FloatingPanelEvents = {
  onAction: (event: FloatingPanelAction) => void;
};

declare class LuluFloatingPanelNativeModule extends NativeModule<FloatingPanelEvents> {
  canDrawOverlays(): boolean;
  requestPermission(): boolean;
  start(): boolean;
  stop(): boolean;
  update(payload: string): boolean;
}

const LuluFloatingPanel = requireNativeModule<LuluFloatingPanelNativeModule>('LuluFloatingPanel');

export function canDrawFloatingPanel() {
  return LuluFloatingPanel.canDrawOverlays();
}

export function requestFloatingPanelPermission() {
  return LuluFloatingPanel.requestPermission();
}

export function startFloatingPanel() {
  return LuluFloatingPanel.start();
}

export function stopFloatingPanel() {
  return LuluFloatingPanel.stop();
}

export function updateFloatingPanel(payload: string) {
  return LuluFloatingPanel.update(payload);
}

export function addFloatingPanelActionListener(listener: (event: FloatingPanelAction) => void) {
  return LuluFloatingPanel.addListener('onAction', listener);
}
