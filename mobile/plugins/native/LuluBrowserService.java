package com.reactnativecommunity.webview;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.media.*;
import android.media.session.*;
import android.net.Uri;
import android.os.*;
import java.lang.ref.WeakReference;
import org.json.JSONObject;

/** Media lifecycle belongs to the browser, not a silent audio track or RN timer. */
public final class LuluBrowserService extends Service {
    private static final int ID = 1501;
    private static final String CHANNEL = "lulu-browser-music";
    private static WeakReference<RNCWebView> owner = new WeakReference<>(null);
    private static LuluBrowserService instance;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private MediaSession session;
    private PowerManager.WakeLock wake;
    private AudioManager audio;
    private AudioFocusRequest focus;
    private boolean paused = true;
    private boolean resumeAfterFocus = false;
    private long lastMediaAt;
    private String title = "YouTube";

    public static boolean receive(RNCWebView view, String message, String source) {
        if (!message.startsWith("{\"type\":\"lulu-native-playback\"")) return false;
        try {
            String host = Uri.parse(source).getHost();
            if (host == null || !(host.equals("youtube.com") || host.endsWith(".youtube.com"))) return true;
            JSONObject state = new JSONObject(message);
            view.post(() -> update(view, state));
        } catch (Exception ignored) { }
        return true;
    }

    private static void update(RNCWebView view, JSONObject state) {
        boolean enabled = state.optBoolean("enabled") && state.optBoolean("hasMedia");
        view.luluBackgroundPlayback = enabled;
        if (!enabled) {
            release(view);
            return;
        }
        owner = new WeakReference<>(view);
        view.onResume();
        view.setRendererPriorityPolicy(android.webkit.WebView.RENDERER_PRIORITY_IMPORTANT, false);
        boolean desiredPause = state.optBoolean("paused");
        if (instance == null && (desiredPause || !state.optBoolean("playing"))) return;
        Intent intent = new Intent(view.getContext(), LuluBrowserService.class)
            .putExtra("paused", desiredPause).putExtra("title", state.optString("title", "YouTube"));
        try {
            if (instance == null) {
                if (Build.VERSION.SDK_INT >= 26) view.getContext().startForegroundService(intent);
                else view.getContext().startService(intent);
            }
            else instance.apply(intent);
        } catch (RuntimeException error) {
            view.luluBackgroundPlayback = false;
            view.evaluateJavascript("window.ReactNativeWebView.postMessage(JSON.stringify({type:'native-background-error'}));", null);
        }
    }

    public static void release(RNCWebView view) {
        view.luluBackgroundPlayback = false;
        if (owner.get() != view) return;
        owner.clear();
        if (instance != null) instance.stopSelf();
    }

    private final BroadcastReceiver noisy = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) { control(true); }
    };

    private final Runnable pulse = new Runnable() {
        @Override public void run() {
            RNCWebView view = owner.get();
            if (view == null || !view.luluBackgroundPlayback) { stopSelf(); return; }
            if (!paused) {
                if (!wake.isHeld()) wake.acquire(10 * 60 * 1000L);
                // Native main looper remains available when React Native is suspended.
                view.evaluateJavascript("window.__luluNativeTick && window.__luluNativeTick();", null);
            }
            if (SystemClock.elapsedRealtime() - lastMediaAt > (paused ? 300000 : 120000)) {
                control(true); stopSelf(); return;
            }
            handler.postDelayed(this, 3000);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        instance = this;
        lastMediaAt = SystemClock.elapsedRealtime();
        if (Build.VERSION.SDK_INT >= 26) getSystemService(NotificationManager.class).createNotificationChannel(
            new NotificationChannel(CHANNEL, "Música de Lulú", NotificationManager.IMPORTANCE_LOW));
        wake = ((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Lulu:BrowserMusic");
        wake.setReferenceCounted(false);
        audio = (AudioManager)getSystemService(AUDIO_SERVICE);
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setOnAudioFocusChangeListener(change -> {
                if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                    resumeAfterFocus = !paused && change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT;
                    control(true);
                } else if (change == AudioManager.AUDIOFOCUS_GAIN && resumeAfterFocus) {
                    resumeAfterFocus = false; control(false);
                }
            }, handler).build();
        session = new MediaSession(this, "LuluBrowser");
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { control(false); }
            @Override public void onPause() { resumeAfterFocus = false; control(true); }
            @Override public void onStop() { control(true); stopSelf(); }
        }, handler);
        session.setActive(true);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
        handler.postDelayed(pulse, 3000);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || owner.get() == null) { stopSelf(); return START_NOT_STICKY; }
        String action = intent.getAction();
        // Meet Android's foreground-service deadline before requesting audio focus.
        publish();
        if ("pause".equals(action)) control(true);
        else if ("play".equals(action)) control(false);
        else if ("stop".equals(action)) { control(true); stopSelf(); }
        else { apply(intent); if (!paused) audio.requestAudioFocus(focus); }
        return START_NOT_STICKY;
    }

    private void apply(Intent intent) {
        boolean nextPaused = intent.getBooleanExtra("paused", true);
        if (!nextPaused || nextPaused != paused) lastMediaAt = SystemClock.elapsedRealtime();
        paused = nextPaused;
        title = intent.getStringExtra("title");
        if (title == null) title = "YouTube";
        if (title.length() > 180) title = title.substring(0, 180);
        if (paused && wake.isHeld()) wake.release();
        if (!paused && !wake.isHeld()) wake.acquire(10 * 60 * 1000L);
        publish();
    }

    private void control(boolean pause) {
        paused = pause;
        lastMediaAt = SystemClock.elapsedRealtime();
        if (pause && wake.isHeld()) wake.release();
        RNCWebView view = owner.get();
        if (view != null) view.evaluateJavascript(
            "window.__luluPlaybackPaused=" + pause + ";document.querySelectorAll('video,audio').forEach(m=>{" +
            (pause ? "m.pause();" : "m.play().catch(()=>{});") +
            "});window.ReactNativeWebView.postMessage(JSON.stringify({type:'user-" + (pause ? "pause" : "play") + "'}));", null);
        publish();
    }

    private PendingIntent action(String action) {
        return PendingIntent.getService(this, action.hashCode(), new Intent(this, LuluBrowserService.class).setAction(action), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void publish() {
        session.setMetadata(new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE, title).putString(MediaMetadata.METADATA_KEY_ARTIST, "Lulú Finity").build());
        session.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_STOP)
            .setState(paused ? PlaybackState.STATE_PAUSED : PlaybackState.STATE_PLAYING, PlaybackState.PLAYBACK_POSITION_UNKNOWN, paused ? 0 : 1).build());
        Notification.Builder n = (Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this)).setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title).setContentText(paused ? "En pausa" : "Reproduciendo en segundo plano")
            .setOnlyAlertOnce(true).setOngoing(!paused).setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(new Notification.Action.Builder(paused ? android.R.drawable.ic_media_play : android.R.drawable.ic_media_pause, paused ? "Continuar" : "Pausar", action(paused ? "play" : "pause")).build())
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel, "Detener", action("stop")).build())
            .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1));
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch != null) n.setContentIntent(PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(ID, n.build());
    }

    @Override public void onTaskRemoved(Intent rootIntent) { control(true); stopSelf(); }
    @Override public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (wake != null && wake.isHeld()) wake.release();
        if (audio != null && focus != null) audio.abandonAudioFocusRequest(focus);
        if (session != null) { session.setActive(false); session.release(); }
        try { unregisterReceiver(noisy); } catch (IllegalArgumentException ignored) { }
        RNCWebView view = owner.get();
        if (view != null) view.luluBackgroundPlayback = false;
        owner.clear(); instance = null;
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
