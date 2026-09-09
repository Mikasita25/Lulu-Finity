const { withDangerousMod, withAndroidManifest } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function patchBrowser(root) {
  const pkg = path.dirname(require.resolve('react-native-webview/package.json', { paths: [root] }));
  const java = path.join(pkg, 'android/src/main/java/com/reactnativecommunity/webview');
  const file = path.join(java, 'RNCWebView.java');
  let source = fs.readFileSync(file, 'utf8');
  if (!source.includes('boolean luluBackgroundPlayback')) {
    const edits = [
      ['    public void onMessage(String message, String sourceUrl) {', '    public void onMessage(String message, String sourceUrl) {\n        if (LuluBrowserService.receive(this, message, sourceUrl)) return;'],
      ['    public void destroy() {', '    public void destroy() {\n        LuluBrowserService.release(this);'],
      ['    @Override\n    public void onHostResume() {', `    public boolean luluBackgroundPlayback = false;

    @Override
    protected void onWindowVisibilityChanged(int visibility) {
        // Chromium normally suspends media when the Activity window is hidden.
        super.onWindowVisibilityChanged(luluBackgroundPlayback ? android.view.View.VISIBLE : visibility);
    }

    @Override
    public void onHostResume() {`],
    ];
    for (const [old, replacement] of edits) {
      if (!source.includes(old)) throw new Error('Unsupported WebView source: background browser patch requires review');
      source = source.replace(old, replacement);
    }
    fs.writeFileSync(file, source);
  }
  fs.copyFileSync(path.join(__dirname, 'native/LuluBrowserService.java'), path.join(java, 'LuluBrowserService.java'));
}
module.exports = function withBackgroundBrowser(config) {
  config = withAndroidManifest(config, c => {
    const app = c.modResults.manifest.application[0];
    app.service = app.service || [];
    const name = 'com.reactnativecommunity.webview.LuluBrowserService';
    if (!app.service.some(s => s.$['android:name'] === name)) app.service.push({ $: { 'android:name': name, 'android:exported': 'false', 'android:foregroundServiceType': 'mediaPlayback', 'android:stopWithTask': 'true' } });
    return c;
  });
  return withDangerousMod(config, ['android', async c => { patchBrowser(c.modRequest.projectRoot); return c; }]);
};
module.exports.patchBrowser = patchBrowser;
