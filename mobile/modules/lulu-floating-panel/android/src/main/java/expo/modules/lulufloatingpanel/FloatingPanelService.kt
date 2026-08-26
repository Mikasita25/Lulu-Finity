package expo.modules.lulufloatingpanel

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import kotlin.math.roundToInt

class FloatingPanelService : Service() {
  companion object {
    const val ACTION_START = "expo.modules.lulufloatingpanel.START"
    const val ACTION_UPDATE = "expo.modules.lulufloatingpanel.UPDATE"
    const val ACTION_CONTROL = "expo.modules.lulufloatingpanel.CONTROL"
    const val EXTRA_PAYLOAD = "payload"
    const val EXTRA_CONTROL_ACTION = "controlAction"

    private const val CHANNEL_ID = "lulu_floating_panel"
    private const val NOTIFICATION_ID = 7314
    private const val IDLE_FADE_MS = 4_500L
  }

  private val handler = Handler(Looper.getMainLooper())
  private lateinit var windowManager: WindowManager
  private var root: LinearLayout? = null
  private var contentArea: LinearLayout? = null
  private var statusText: TextView? = null
  private var statsText: TextView? = null
  private val eventViews = mutableListOf<TextView>()
  private var musicArea: LinearLayout? = null
  private var songText: TextView? = null
  private var queueText: TextView? = null
  private var pauseButton: TextView? = null
  private var collapseButton: TextView? = null
  private var layoutParams: WindowManager.LayoutParams? = null
  private var lastActivityKey = ""
  private var collapsed = false

  private val fadeRunnable = Runnable {
    root?.animate()?.alpha(0.30f)?.setDuration(550L)?.start()
  }

  override fun onCreate() {
    super.onCreate()
    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    ensureForeground()

    if (!Settings.canDrawOverlays(this)) {
      stopSelf()
      return START_NOT_STICKY
    }

    if (root == null) createPanel()

    when (intent?.action) {
      ACTION_UPDATE -> renderPayload(intent.getStringExtra(EXTRA_PAYLOAD).orEmpty())
      ACTION_START, null -> wakePanel()
    }

    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    root?.let {
      try {
        windowManager.removeView(it)
      } catch (_: Exception) {
      }
    }
    root = null
    super.onDestroy()
  }

  private fun ensureForeground() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          "Panel flotante de Lulú Finity",
          NotificationManager.IMPORTANCE_LOW
        ).apply {
          description = "Mantiene visible el panel del LIVE sobre otras aplicaciones."
          setShowBadge(false)
        }
      )
    }

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    val pendingIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    builder
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("Lulú Finity · Panel flotante")
      .setContentText("Eventos del LIVE y controles rápidos activos")
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setOnlyAlertOnce(true)
    if (pendingIntent != null) builder.setContentIntent(pendingIntent)

    val notification = builder.build()
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun createPanel() {
    val panel = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(12), dp(10), dp(12), dp(10))
      background = roundedBackground(Color.argb(232, 18, 14, 20), 20f, Color.argb(110, 255, 95, 200))
      elevation = dp(12).toFloat()
      alpha = 1f
    }

    val header = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    val dragArea = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(0, dp(2), dp(6), dp(4))
    }
    dragArea.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)

    val title = TextView(this).apply {
      text = "LULÚ · LIVE"
      setTextColor(Color.WHITE)
      textSize = 13f
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      maxLines = 1
    }
    val status = TextView(this).apply {
      text = "Sin conexión"
      setTextColor(Color.argb(185, 255, 255, 255))
      textSize = 10f
      maxLines = 1
    }
    statusText = status
    dragArea.addView(title)
    dragArea.addView(status)

    val open = smallButton("↗").apply {
      contentDescription = "Abrir Lulú Finity"
      setOnClickListener {
        wakePanel()
        openApp()
      }
    }
    val collapse = smallButton("−").apply {
      contentDescription = "Contraer panel"
      setOnClickListener {
        wakePanel()
        collapsed = !collapsed
        contentArea?.visibility = if (collapsed) View.GONE else View.VISIBLE
        text = if (collapsed) "+" else "−"
      }
    }
    collapseButton = collapse
    val close = smallButton("×").apply {
      contentDescription = "Cerrar panel flotante"
      setOnClickListener {
        sendControl("close")
        stopSelf()
      }
    }

    header.addView(dragArea)
    header.addView(open)
    header.addView(collapse)
    header.addView(close)
    panel.addView(header)

    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(0, dp(8), 0, 0)
    }
    contentArea = content

    val stats = TextView(this).apply {
      setTextColor(Color.rgb(244, 228, 240))
      textSize = 11f
      text = "◉ 0   ♥ 0   + 0   ◆ 0"
      setPadding(dp(8), dp(7), dp(8), dp(7))
      background = roundedBackground(Color.argb(115, 255, 255, 255), 12f)
      maxLines = 1
    }
    statsText = stats
    content.addView(stats)

    val events = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(0, dp(6), 0, dp(4))
    }
    repeat(4) { index ->
      val eventView = TextView(this).apply {
        setTextColor(if (index == 0) Color.WHITE else Color.argb(205, 255, 255, 255))
        textSize = if (index == 0) 11.5f else 10.5f
        maxLines = 2
        ellipsize = android.text.TextUtils.TruncateAt.END
        setPadding(dp(5), dp(3), dp(5), dp(3))
        visibility = View.GONE
      }
      eventViews.add(eventView)
      events.addView(eventView)
    }
    content.addView(events)

    val music = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(8), dp(7), dp(6), dp(7))
      background = roundedBackground(Color.argb(105, 255, 95, 200), 13f)
      visibility = View.GONE
    }
    musicArea = music

    val musicTextArea = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
    }
    val song = TextView(this).apply {
      setTextColor(Color.WHITE)
      textSize = 10.5f
      maxLines = 1
      ellipsize = android.text.TextUtils.TruncateAt.END
      text = "Sin canción"
    }
    val queue = TextView(this).apply {
      setTextColor(Color.argb(175, 255, 255, 255))
      textSize = 9f
      maxLines = 1
      text = "Cola vacía"
    }
    songText = song
    queueText = queue
    musicTextArea.addView(song)
    musicTextArea.addView(queue)

    val pause = smallButton("Ⅱ").apply {
      contentDescription = "Pausar o reanudar música"
      setOnClickListener {
        wakePanel()
        sendControl("togglePause")
      }
    }
    pauseButton = pause
    val skip = smallButton("≫").apply {
      contentDescription = "Saltar canción"
      setOnClickListener {
        wakePanel()
        sendControl("skip")
      }
    }

    music.addView(musicTextArea)
    music.addView(pause)
    music.addView(skip)
    content.addView(music)
    panel.addView(content)

    val params = WindowManager.LayoutParams(
      dp(310),
      WindowManager.LayoutParams.WRAP_CONTENT,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION")
        WindowManager.LayoutParams.TYPE_PHONE
      },
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.END
      x = dp(10)
      y = dp(86)
    }
    layoutParams = params

    installDragBehavior(dragArea)
    panel.setOnClickListener { wakePanel() }

    root = panel
    windowManager.addView(panel, params)
    wakePanel()
  }

  private fun renderPayload(raw: String) {
    if (raw.isBlank()) return
    val payload = try {
      JSONObject(raw)
    } catch (_: Exception) {
      return
    }

    val relay = payload.optString("relayState", "idle")
    val username = payload.optString("username", "")
    statusText?.text = when (relay) {
      "connected" -> if (username.isNotBlank()) "@$username · conectado" else "LIVE conectado"
      "connecting" -> "Conectando…"
      "rotating" -> "Reconectando…"
      "offline" -> "LIVE sin conexión"
      "error" -> "Error de conexión"
      else -> "Panel activo"
    }

    val stats = payload.optJSONObject("stats")
    val viewers = stats?.optInt("viewers", 0) ?: 0
    val likes = stats?.optInt("likes", 0) ?: 0
    val followers = stats?.optInt("followers", 0) ?: 0
    val gifts = stats?.optInt("gifts", 0) ?: 0
    statsText?.text = "◉ ${compact(viewers)}   ♥ ${compact(likes)}   + ${compact(followers)}   ◆ ${compact(gifts)}"

    val events = payload.optJSONArray("events")
    for (index in eventViews.indices) {
      val text = events?.optString(index).orEmpty().trim()
      eventViews[index].apply {
        this.text = text
        visibility = if (text.isBlank()) View.GONE else View.VISIBLE
      }
    }

    val song = payload.optString("song", "").trim()
    val paused = payload.optBoolean("paused", false)
    val queueCount = payload.optInt("queueCount", 0)
    if (song.isBlank()) {
      musicArea?.visibility = View.GONE
    } else {
      musicArea?.visibility = View.VISIBLE
      songText?.text = song
      queueText?.text = if (queueCount > 0) "$queueCount en cola" else "Sin canciones en cola"
      pauseButton?.text = if (paused) "▶" else "Ⅱ"
    }

    val activityKey = payload.optString("activityKey", "")
    if (activityKey.isNotBlank() && activityKey != lastActivityKey) {
      lastActivityKey = activityKey
      wakePanel()
    }
  }

  private fun installDragBehavior(view: View) {
    var touchX = 0f
    var touchY = 0f
    var startX = 0
    var startY = 0
    view.setOnTouchListener { _, event ->
      val params = layoutParams ?: return@setOnTouchListener false
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          wakePanel()
          touchX = event.rawX
          touchY = event.rawY
          startX = params.x
          startY = params.y
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = event.rawX - touchX
          val dy = event.rawY - touchY
          params.x = (startX - dx).roundToInt()
          params.y = (startY + dy).roundToInt().coerceAtLeast(0)
          root?.let {
            try {
              windowManager.updateViewLayout(it, params)
            } catch (_: Exception) {
            }
          }
          true
        }
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          wakePanel()
          true
        }
        else -> false
      }
    }
  }

  private fun wakePanel() {
    handler.removeCallbacks(fadeRunnable)
    root?.animate()?.alpha(1f)?.setDuration(120L)?.start()
    handler.postDelayed(fadeRunnable, IDLE_FADE_MS)
  }

  private fun openApp() {
    val intent = packageManager.getLaunchIntentForPackage(packageName) ?: return
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    try {
      startActivity(intent)
    } catch (_: Exception) {
    }
  }

  private fun sendControl(action: String) {
    sendBroadcast(
      Intent(ACTION_CONTROL)
        .setPackage(packageName)
        .putExtra(EXTRA_CONTROL_ACTION, action)
    )
  }

  private fun smallButton(label: String) = TextView(this).apply {
    text = label
    gravity = Gravity.CENTER
    setTextColor(Color.WHITE)
    textSize = 16f
    minWidth = dp(38)
    minHeight = dp(38)
    setPadding(dp(8), dp(5), dp(8), dp(5))
    background = roundedBackground(Color.argb(75, 255, 255, 255), 12f)
    val margins = LinearLayout.LayoutParams(dp(38), dp(38)).apply {
      marginStart = dp(5)
    }
    layoutParams = margins
  }

  private fun roundedBackground(color: Int, radiusDp: Float, strokeColor: Int? = null): GradientDrawable {
    return GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      setColor(color)
      cornerRadius = dp(radiusDp).toFloat()
      if (strokeColor != null) setStroke(dp(1), strokeColor)
    }
  }

  private fun compact(value: Int): String {
    return when {
      value >= 1_000_000 -> String.format("%.1fM", value / 1_000_000f).replace(".0", "")
      value >= 1_000 -> String.format("%.1fK", value / 1_000f).replace(".0", "")
      else -> value.toString()
    }
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()
  private fun dp(value: Float): Int = (value * resources.displayMetrics.density).roundToInt()
}
