package `in`.daqwon.ops

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Keeps checking the finance queue while the app is in the background and raises a loud
 * notification for every new deposit or withdrawal that needs a decision. No third-party push:
 * a foreground service polls the WinDaq API every [POLL_MS].
 */
class WatchService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var loop: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureChannels(this)
        ServiceCompat.startForeground(
            this, ONGOING_ID, ongoing("Watching for deposits and withdrawals"),
            if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC else 0
        )
        if (loop?.isActive != true) loop = scope.launch { pollForever() }
        return START_STICKY
    }

    private suspend fun pollForever() {
        val store = Store(this)
        val api = Api { store.token }
        while (scope.isActive) {
            if (store.token == null || !store.watching) {
                stopSelf()
                return
            }
            try {
                val queue = api.queue()
                val pending = queue.deposits + queue.withdrawals
                val seen = store.seenIds
                pending.filter { it.id !in seen }.forEach { alert(it) }
                store.seenIds = seen + pending.map { it.id }
                updateOngoing("${queue.deposits.size} deposits · ${queue.withdrawals.size} withdrawals waiting")
            } catch (e: ApiException) {
                if (e.status == 401 || e.status == 403) {
                    store.signOut()
                    notifyPlain(SESSION_ID, "Signed out", "Your session ended. Open WinDaq Ops and sign in again to keep getting alerts.")
                    stopSelf()
                    return
                }
                updateOngoing("Retrying… (${e.message})")
            } catch (e: Exception) {
                updateOngoing("No connection, retrying…")
            }
            delay(POLL_MS)
        }
    }

    private fun alert(item: QueueItem) {
        val title = if (item.type == "DEPOSIT") "Deposit to verify: ₹${money(item.amount)}" else "Withdrawal to pay: ₹${money(item.amount)}"
        val body = if (item.type == "DEPOSIT") {
            "${item.phone ?: "Player"} · UTR ${item.utr ?: "—"}. Check the payment and approve."
        } else {
            "${item.phone ?: "Player"} → ${item.destination ?: "UPI"}. Tap to pay and mark paid."
        }
        notifyPlain(item.id.hashCode(), title, body, CHANNEL_ALERTS)
    }

    private fun notifyPlain(id: Int, title: String, body: String, channel: String = CHANNEL_ALERTS) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val n = NotificationCompat.Builder(this, channel)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(openApp(this))
            .build()
        NotificationManagerCompat.from(this).notify(id, n)
    }

    private fun ongoing(text: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_WATCH)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle("WinDaq Ops is watching")
            .setContentText(text)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(openApp(this))
            .build()

    private fun updateOngoing(text: String) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        NotificationManagerCompat.from(this).notify(ONGOING_ID, ongoing(text))
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        const val POLL_MS = 15_000L
        const val CHANNEL_ALERTS = "payment_alerts"
        const val CHANNEL_WATCH = "watcher"
        private const val ONGOING_ID = 1
        private const val SESSION_ID = 2

        fun money(v: Double): String = String.format(java.util.Locale.US, "%,.2f", v)

        fun ensureChannels(ctx: Context) {
            val nm = ctx.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ALERTS, "Payments to review", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "New deposits and withdrawals waiting for a decision"
                    enableVibration(true)
                }
            )
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_WATCH, "Background watcher", NotificationManager.IMPORTANCE_MIN).apply {
                    description = "Shows that WinDaq Ops is checking for payments"
                }
            )
        }

        fun openApp(ctx: Context): PendingIntent = PendingIntent.getActivity(
            ctx, 0,
            Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        fun start(ctx: Context) {
            ContextCompat.startForegroundService(ctx, Intent(ctx, WatchService::class.java))
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, WatchService::class.java))
        }
    }
}
