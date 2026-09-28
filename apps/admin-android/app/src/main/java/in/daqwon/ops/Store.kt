package `in`.daqwon.ops

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** Session token and small app state, encrypted at rest with a hardware-backed key. */
class Store(context: Context) {
    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "ops_secure",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    var token: String?
        get() = prefs.getString("token", null)
        set(value) = prefs.edit().putString("token", value).apply()

    var phone: String?
        get() = prefs.getString("phone", null)
        set(value) = prefs.edit().putString("phone", value).apply()

    var role: String?
        get() = prefs.getString("role", null)
        set(value) = prefs.edit().putString("role", value).apply()

    var watching: Boolean
        get() = prefs.getBoolean("watching", true)
        set(value) = prefs.edit().putBoolean("watching", value).apply()

    /** Request ids already notified, so each new request alerts once. */
    var seenIds: Set<String>
        get() = prefs.getStringSet("seen", emptySet()) ?: emptySet()
        set(value) = prefs.edit().putStringSet("seen", value.toList().takeLast(500).toSet()).apply()

    fun signOut() {
        prefs.edit().remove("token").remove("role").remove("seen").apply()
    }
}
