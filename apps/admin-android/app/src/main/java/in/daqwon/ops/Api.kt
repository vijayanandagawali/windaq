package `in`.daqwon.ops

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ApiException(val code: String, message: String, val status: Int) : Exception(message)

data class QueueItem(
    val id: String,
    val type: String,
    val amount: Double,
    val phone: String?,
    val utr: String?,
    val destination: String?,
    val createdAt: String
)

data class BankCredit(val id: String, val utr: String, val amount: Double, val status: String, val payerName: String?, val receivedAt: String)

data class Queue(val deposits: List<QueueItem>, val withdrawals: List<QueueItem>, val unmatchedCredits: List<BankCredit>)

data class LoginResult(val token: String, val role: String, val phone: String)

/** Minimal JSON client for the WinDaq finance API (HTTPS only, bearer session token). */
class Api(private val tokenProvider: () -> String?) {
    private val base = BuildConfig.API_BASE

    private suspend fun call(method: String, path: String, body: JSONObject? = null, auth: Boolean = true): JSONObject =
        withContext(Dispatchers.IO) {
            val conn = (URL(base + path).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 10_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
                if (auth) tokenProvider()?.let { setRequestProperty("Authorization", "Bearer $it") }
                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
            }
            try {
                if (body != null) conn.outputStream.use { it.write(body.toString().toByteArray()) }
                val status = conn.responseCode
                val text = (if (status >= 400) conn.errorStream else conn.inputStream)?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = runCatching { JSONObject(text) }.getOrElse { JSONObject() }
                if (status >= 400 || json.optBoolean("success", true) == false) {
                    throw ApiException(json.optString("code", "HTTP_$status"), json.optString("message", "Request failed ($status)"), status)
                }
                json
            } finally {
                conn.disconnect()
            }
        }

    suspend fun sendOtp(phone: String) {
        call("POST", "/api/auth/send-otp", JSONObject().put("phone", phone), auth = false)
    }

    suspend fun login(phone: String, otp: String): LoginResult {
        val json = call("POST", "/api/auth/login", JSONObject().put("phone", phone).put("otp", otp), auth = false)
        val user = json.optJSONObject("user") ?: JSONObject()
        val token = json.optString("token")
        if (token.isBlank()) throw ApiException("NO_TOKEN", "Login did not return a session.", 500)
        return LoginResult(token, user.optString("role", "USER"), user.optString("phone", phone))
    }

    suspend fun queue(): Queue {
        val data = call("GET", "/api/payments/admin/queue").getJSONObject("data")
        fun items(key: String) = data.getJSONArray(key).let { arr ->
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                QueueItem(
                    id = o.getString("id"),
                    type = o.getString("type"),
                    amount = o.getDouble("amount"),
                    phone = o.optString("phone").ifBlank { null },
                    utr = o.optString("utr").takeIf { it.isNotBlank() && it != "null" },
                    destination = o.optString("destination").takeIf { it.isNotBlank() && it != "null" },
                    createdAt = o.getString("createdAt")
                )
            }
        }
        val credits = data.getJSONArray("unmatchedCredits").let { arr ->
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                BankCredit(o.getString("id"), o.getString("utr"), o.getDouble("amount"), o.getString("status"),
                    o.optString("payerName").takeIf { it.isNotBlank() && it != "null" }, o.getString("receivedAt"))
            }
        }
        return Queue(items("deposits"), items("withdrawals"), credits)
    }

    suspend fun approveDeposit(id: String, note: String) =
        call("POST", "/api/payments/admin/deposits/$id/approve", JSONObject().put("note", note)).optString("message")

    suspend fun rejectDeposit(id: String, reason: String) =
        call("POST", "/api/payments/admin/deposits/$id/reject", JSONObject().put("note", reason)).optString("message")

    /** The note must be the payout UTR: the server refuses to mark a withdrawal paid without it. */
    suspend fun approveWithdrawal(id: String, payoutUtr: String) =
        call("POST", "/api/payments/admin/withdrawals/$id/approve", JSONObject().put("note", payoutUtr)).optString("message")

    suspend fun rejectWithdrawal(id: String, reason: String) =
        call("POST", "/api/payments/admin/withdrawals/$id/reject", JSONObject().put("note", reason)).optString("message")
}
