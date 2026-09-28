package `in`.daqwon.ops

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Resumes payment alerts after the phone restarts, if the admin is signed in with alerts on. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val store = Store(context)
        if (store.token != null && store.watching) WatchService.start(context)
    }
}
