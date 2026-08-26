package expo.modules.lulufloatingpanel

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LuluFloatingPanelModule : Module() {
  private var controlReceiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("LuluFloatingPanel")
    Events("onAction")

    OnCreate {
      registerControlReceiver()
    }

    OnDestroy {
      unregisterControlReceiver()
    }

    Function("canDrawOverlays") {
      val context = appContext.reactContext ?: return@Function false
      Settings.canDrawOverlays(context)
    }

    Function("requestPermission") {
      val context = appContext.reactContext ?: return@Function false
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}")
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    }

    Function("start") {
      val context = appContext.reactContext ?: return@Function false
      if (!Settings.canDrawOverlays(context)) return@Function false
      val intent = Intent(context, FloatingPanelService::class.java)
        .setAction(FloatingPanelService.ACTION_START)
      ContextCompat.startForegroundService(context, intent)
      true
    }

    Function("stop") {
      val context = appContext.reactContext ?: return@Function false
      context.stopService(Intent(context, FloatingPanelService::class.java))
      true
    }

    Function("update") { payload: String ->
      val context = appContext.reactContext ?: return@Function false
      if (!Settings.canDrawOverlays(context)) return@Function false
      val intent = Intent(context, FloatingPanelService::class.java)
        .setAction(FloatingPanelService.ACTION_UPDATE)
        .putExtra(FloatingPanelService.EXTRA_PAYLOAD, payload)
      ContextCompat.startForegroundService(context, intent)
      true
    }
  }

  private fun registerControlReceiver() {
    val context = appContext.reactContext ?: return
    if (controlReceiver != null) return
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        val action = intent?.getStringExtra(FloatingPanelService.EXTRA_CONTROL_ACTION) ?: return
        sendEvent("onAction", mapOf("action" to action))
      }
    }
    val filter = IntentFilter(FloatingPanelService.ACTION_CONTROL)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      context.registerReceiver(receiver, filter)
    }
    controlReceiver = receiver
  }

  private fun unregisterControlReceiver() {
    val context = appContext.reactContext ?: return
    controlReceiver?.let {
      try {
        context.unregisterReceiver(it)
      } catch (_: Exception) {
      }
    }
    controlReceiver = null
  }
}
