package `in`.daqwon.ops

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.widget.Toast
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val Mint = Color(0xFF059669)
private val Sky = Color(0xFF0EA5E9)
private val Ink = Color(0xFF0F172A)
private val Muted = Color(0xFF64748B)
private val Rose = Color(0xFFE11D48)
private val Card = Color.White
private val Page = Color(0xFFF4FAF9)

private const val RELOCK_AFTER_MS = 2 * 60 * 1000L

class MainActivity : FragmentActivity() {
    private lateinit var store: Store
    private lateinit var api: Api

    private var unlocked by mutableStateOf(false)
    private var lockUnavailable by mutableStateOf(false)
    private var backgroundedAt = 0L

    /** Filled when a UPI app returns from a payout; the UI shows the "mark paid" dialog. */
    private var payoutReturn by mutableStateOf<Pair<QueueItem, String?>?>(null)
    private var payingItem: QueueItem? = null

    private val payLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val item = payingItem ?: return@registerForActivityResult
        payingItem = null
        payoutReturn = item to extractUtr(result.data?.getStringExtra("response"))
    }

    private val notifPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = Store(this)
        api = Api { store.token }
        WatchService.ensureChannels(this)
        if (Build.VERSION.SDK_INT >= 33) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        setContent { MaterialTheme(colorScheme = lightColorScheme(primary = Mint, secondary = Sky)) { Root() } }
    }

    override fun onResume() {
        super.onResume()
        if (unlocked && backgroundedAt > 0 && SystemClock.elapsedRealtime() - backgroundedAt > RELOCK_AFTER_MS) unlocked = false
        if (!unlocked) requestUnlock()
    }

    override fun onStop() {
        super.onStop()
        backgroundedAt = SystemClock.elapsedRealtime()
    }

    /** Payments are money actions: require the phone's fingerprint / face / PIN to open the app. */
    private fun requestUnlock() {
        val allowed = BIOMETRIC_WEAK or DEVICE_CREDENTIAL
        if (BiometricManager.from(this).canAuthenticate(allowed) != BiometricManager.BIOMETRIC_SUCCESS) {
            lockUnavailable = true
            unlocked = true
            return
        }
        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                unlocked = true
            }
        })
        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder()
                .setTitle("Unlock WinDaq Ops")
                .setSubtitle("Confirm it's you to review payments")
                .setAllowedAuthenticators(allowed)
                .build()
        )
    }

    private fun copy(label: String, text: String) {
        getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText(label, text))
        Toast.makeText(this, "$label copied", Toast.LENGTH_SHORT).show()
    }

    private fun launchPayout(item: QueueItem) {
        val vpa = item.destination ?: return
        val uri = Uri.Builder().scheme("upi").authority("pay")
            .appendQueryParameter("pa", vpa)
            .appendQueryParameter("pn", "WinDaq player")
            .appendQueryParameter("am", String.format(java.util.Locale.US, "%.2f", item.amount))
            .appendQueryParameter("cu", "INR")
            .appendQueryParameter("tn", "WinDaq payout ${item.id.take(8)}")
            .build()
        payingItem = item
        try {
            payLauncher.launch(Intent.createChooser(Intent(Intent.ACTION_VIEW, uri), "Pay with"))
        } catch (e: Exception) {
            payingItem = null
            Toast.makeText(this, "No UPI app found. Copy the UPI ID and pay manually.", Toast.LENGTH_LONG).show()
        }
    }

    // ------------------------------------------------------------------ UI

    @Composable
    private fun Root() {
        var signedIn by remember { mutableStateOf(store.token != null) }
        Box(Modifier.fillMaxSize().background(Page)) {
            when {
                !unlocked -> Locked()
                !signedIn -> Login(onDone = { signedIn = true })
                else -> Dashboard(onSignOut = {
                    WatchService.stop(this@MainActivity)
                    store.signOut()
                    signedIn = false
                })
            }
        }
    }

    @Composable
    private fun Locked() {
        Column(Modifier.fillMaxSize().padding(32.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
            Text("WinDaq Ops is locked", fontWeight = FontWeight.Black, fontSize = 20.sp, color = Ink)
            Spacer(Modifier.height(12.dp))
            Button(onClick = { requestUnlock() }) { Text("Unlock") }
        }
    }

    @Composable
    private fun Login(onDone: () -> Unit) {
        val scope = rememberCoroutineScope()
        var phone by remember { mutableStateOf(store.phone?.removePrefix("+91") ?: "") }
        var otp by remember { mutableStateOf("") }
        var otpSent by remember { mutableStateOf(false) }
        var busy by remember { mutableStateOf(false) }
        var error by remember { mutableStateOf<String?>(null) }

        Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
            Header("WinDaq Ops", "Finance command center")
            Spacer(Modifier.height(28.dp))
            OutlinedTextField(
                value = phone, onValueChange = { phone = it.filter(Char::isDigit).take(10) },
                label = { Text("Admin mobile number") }, prefix = { Text("+91 ") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth(), enabled = !otpSent
            )
            if (otpSent) {
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = otp, onValueChange = { otp = it.filter(Char::isDigit).take(6) },
                    label = { Text("OTP") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword), modifier = Modifier.fillMaxWidth()
                )
            }
            error?.let { Spacer(Modifier.height(8.dp)); Text(it, color = Rose, fontSize = 13.sp) }
            Spacer(Modifier.height(16.dp))
            Button(
                enabled = !busy && phone.length == 10 && (!otpSent || otp.length >= 4),
                modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(14.dp),
                onClick = {
                    busy = true; error = null
                    scope.launch {
                        try {
                            if (!otpSent) {
                                api.sendOtp(phone); otpSent = true
                            } else {
                                val r = api.login(phone, otp)
                                if (r.role !in listOf("FINANCE", "SUPER_ADMIN")) {
                                    error = "This number does not have finance access."
                                } else {
                                    store.token = r.token; store.phone = r.phone; store.role = r.role; store.watching = true
                                    WatchService.start(this@MainActivity)
                                    onDone()
                                }
                            }
                        } catch (e: Exception) {
                            error = e.message ?: "Something went wrong"
                        } finally { busy = false }
                    }
                }
            ) { Text(if (!otpSent) "Send OTP" else "Sign in", fontWeight = FontWeight.Bold) }
            if (otpSent) TextButton(onClick = { otpSent = false; otp = "" }) { Text("Change number") }
        }
    }

    @Composable
    private fun Header(title: String, subtitle: String) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(44.dp).background(Brush.linearGradient(listOf(Sky, Mint)), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center
            ) { Text("W", color = Color.White, fontWeight = FontWeight.Black, fontSize = 20.sp) }
            Spacer(Modifier.width(12.dp))
            Column {
                Text(title, fontWeight = FontWeight.Black, fontSize = 22.sp, color = Ink)
                Text(subtitle, color = Muted, fontSize = 13.sp)
            }
        }
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    private fun Dashboard(onSignOut: () -> Unit) {
        val scope = rememberCoroutineScope()
        var queue by remember { mutableStateOf<Queue?>(null) }
        var error by remember { mutableStateOf<String?>(null) }
        var loading by remember { mutableStateOf(false) }
        var tab by remember { mutableIntStateOf(0) }
        var watching by remember { mutableStateOf(store.watching) }
        var confirmDeposit by remember { mutableStateOf<QueueItem?>(null) }
        var rejecting by remember { mutableStateOf<QueueItem?>(null) }
        var markPaid by remember { mutableStateOf<Pair<QueueItem, String?>?>(null) }

        suspend fun refresh() {
            loading = true
            try { queue = api.queue(); error = null } catch (e: ApiException) {
                if (e.status == 401 || e.status == 403) { onSignOut(); return }
                error = e.message
            } catch (e: Exception) { error = "No connection" } finally { loading = false }
        }

        fun act(block: suspend () -> String) {
            scope.launch {
                try {
                    val msg = block()
                    Toast.makeText(this@MainActivity, msg.ifBlank { "Done" }, Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, e.message ?: "Failed", Toast.LENGTH_LONG).show()
                }
                refresh()
            }
        }

        LaunchedEffect(Unit) {
            if (watching) WatchService.start(this@MainActivity)
            while (true) { refresh(); delay(10_000) }
        }
        // A UPI app just returned from a payout: ask for the UTR to mark it paid.
        LaunchedEffect(payoutReturn) { payoutReturn?.let { markPaid = it; payoutReturn = null } }

        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { Header("WinDaq Ops", "${store.phone ?: ""} · ${store.role ?: ""}") }
                TextButton(onClick = onSignOut) { Text("Sign out", color = Muted) }
            }
            if (lockUnavailable) Banner("Set a screen lock on this phone so nobody else can approve payments.", Rose)
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp).background(Card, RoundedCornerShape(14.dp)).padding(horizontal = 14.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Background alerts", fontWeight = FontWeight.Bold, color = Ink)
                    Text(if (watching) "Checking every 15 seconds" else "Off — you won't be notified", fontSize = 12.sp, color = Muted)
                }
                Switch(checked = watching, onCheckedChange = {
                    watching = it; store.watching = it
                    if (it) WatchService.start(this@MainActivity) else WatchService.stop(this@MainActivity)
                })
            }
            Spacer(Modifier.height(10.dp))
            val q = queue
            TabRow(selectedTabIndex = tab, containerColor = Page) {
                Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Deposits (${q?.deposits?.size ?: 0})") })
                Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Payouts (${q?.withdrawals?.size ?: 0})") })
                Tab(selected = tab == 2, onClick = { tab = 2 }, text = { Text("Bank (${q?.unmatchedCredits?.size ?: 0})") })
            }
            error?.let { Banner(it, Rose) }
            if (loading && q == null) LinearProgressIndicator(Modifier.fillMaxWidth())

            LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.weight(1f)) {
                when (tab) {
                    0 -> {
                        if (q != null && q.deposits.isEmpty()) item { Empty("No deposits waiting. Unique-amount payments are credited automatically when the bank SMS arrives.") }
                        items(q?.deposits ?: emptyList(), key = { it.id }) { d ->
                            ItemCard(d) {
                                KV("UTR", d.utr ?: "—", mono = true, onCopy = d.utr?.let { u -> { copy("UTR", u) } })
                                Text("Open your bank / GPay history and check this UTR and amount arrived.", fontSize = 12.sp, color = Muted)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(onClick = { confirmDeposit = d }, modifier = Modifier.weight(1f)) { Text("Received · Credit") }
                                    OutlinedButton(onClick = { rejecting = d }) { Text("Reject", color = Rose) }
                                }
                            }
                        }
                    }
                    1 -> {
                        if (q != null && q.withdrawals.isEmpty()) item { Empty("No withdrawals waiting.") }
                        items(q?.withdrawals ?: emptyList(), key = { it.id }) { w ->
                            ItemCard(w) {
                                KV("Pay to", w.destination ?: "—", mono = true, onCopy = w.destination?.let { v -> { copy("UPI ID", v) } })
                                KV("Amount", "₹${WatchService.money(w.amount)}", onCopy = { copy("Amount", String.format(java.util.Locale.US, "%.2f", w.amount)) })
                                Button(onClick = { launchPayout(w) }, enabled = w.destination != null, modifier = Modifier.fillMaxWidth()) {
                                    Text("Pay ₹${WatchService.money(w.amount)} with UPI app")
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedButton(onClick = { markPaid = w to null }, modifier = Modifier.weight(1f)) { Text("Already paid · enter UTR") }
                                    OutlinedButton(onClick = { rejecting = w }) { Text("Reject", color = Rose) }
                                }
                            }
                        }
                    }
                    else -> {
                        if (q != null && q.unmatchedCredits.isEmpty()) item { Empty("Every bank credit SMS has been matched.") }
                        items(q?.unmatchedCredits ?: emptyList(), key = { it.id }) { c ->
                            Column(Modifier.fillMaxWidth().background(Card, RoundedCornerShape(16.dp)).padding(14.dp)) {
                                Text("₹${WatchService.money(c.amount)}", fontWeight = FontWeight.Black, fontSize = 20.sp, color = Ink)
                                Text("${c.status.replace('_', ' ')} · ${c.payerName ?: "unknown payer"} · ${time(c.receivedAt)}", fontSize = 12.sp, color = Muted)
                                KV("UTR", c.utr, mono = true, onCopy = { copy("UTR", c.utr) })
                                Text("Money arrived but no player claimed it. Ask the player to enter this UTR in their deposit.", fontSize = 12.sp, color = Muted)
                            }
                        }
                    }
                }
            }
        }

        confirmDeposit?.let { d ->
            AlertDialog(
                onDismissRequest = { confirmDeposit = null },
                title = { Text("Credit ₹${WatchService.money(d.amount)}?") },
                text = { Text("Only confirm if your bank or UPI app shows ₹${WatchService.money(d.amount)} received with UTR ${d.utr ?: "—"}. This adds real money to ${d.phone ?: "the player"}'s wallet.") },
                confirmButton = { Button(onClick = { confirmDeposit = null; act { api.approveDeposit(d.id, "Verified in bank app (Ops app)") } }) { Text("Yes, received") } },
                dismissButton = { TextButton(onClick = { confirmDeposit = null }) { Text("Cancel") } }
            )
        }

        rejecting?.let { item ->
            var reason by remember(item.id) { mutableStateOf("") }
            AlertDialog(
                onDismissRequest = { rejecting = null },
                title = { Text(if (item.type == "DEPOSIT") "Reject deposit" else "Reject withdrawal") },
                text = {
                    Column {
                        Text(if (item.type == "DEPOSIT") "The player is not credited." else "The locked ₹${WatchService.money(item.amount)} goes back to the player's balance.", fontSize = 13.sp)
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(value = reason, onValueChange = { reason = it.take(200) }, label = { Text("Reason (shown in audit log)") })
                    }
                },
                confirmButton = {
                    Button(enabled = reason.trim().length >= 3, colors = ButtonDefaults.buttonColors(containerColor = Rose), onClick = {
                        rejecting = null
                        act { if (item.type == "DEPOSIT") api.rejectDeposit(item.id, reason.trim()) else api.rejectWithdrawal(item.id, reason.trim()) }
                    }) { Text("Reject") }
                },
                dismissButton = { TextButton(onClick = { rejecting = null }) { Text("Cancel") } }
            )
        }

        markPaid?.let { (item, detected) ->
            var utr by remember(item.id) { mutableStateOf(detected ?: "") }
            AlertDialog(
                onDismissRequest = { markPaid = null },
                title = { Text("Mark ₹${WatchService.money(item.amount)} as paid") },
                text = {
                    Column {
                        Text(
                            if (detected != null) "The UPI app reported this reference. Check it matches your payment history."
                            else "Enter the 12-digit UTR from your UPI app for the payment to ${item.destination ?: "the player"}.",
                            fontSize = 13.sp
                        )
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(value = utr, onValueChange = { utr = it.filter(Char::isLetterOrDigit).take(30) }, label = { Text("Payout UTR") },
                            singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                    }
                },
                confirmButton = {
                    Button(enabled = utr.length >= 8, onClick = { markPaid = null; act { api.approveWithdrawal(item.id, utr) } }) { Text("Mark paid") }
                },
                dismissButton = { TextButton(onClick = { markPaid = null }) { Text("Not paid") } }
            )
        }
    }

    @Composable
    private fun ItemCard(item: QueueItem, content: @Composable ColumnScope.() -> Unit) {
        Column(Modifier.fillMaxWidth().background(Card, RoundedCornerShape(16.dp)).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("₹${WatchService.money(item.amount)}", fontWeight = FontWeight.Black, fontSize = 22.sp, color = Ink, modifier = Modifier.weight(1f))
                Text(time(item.createdAt), fontSize = 12.sp, color = Muted)
            }
            Text(item.phone ?: "Unknown player", color = Muted, fontSize = 13.sp)
            content()
        }
    }

    @Composable
    private fun KV(label: String, value: String, mono: Boolean = false, onCopy: (() -> Unit)? = null) {
        Row(
            Modifier.fillMaxWidth().background(Page, RoundedCornerShape(10.dp)).padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(label.uppercase(), fontSize = 10.sp, color = Muted, fontWeight = FontWeight.Bold)
                Text(value, fontFamily = if (mono) FontFamily.Monospace else FontFamily.Default, fontWeight = FontWeight.SemiBold, color = Ink)
            }
            if (onCopy != null) TextButton(onClick = onCopy) { Text("Copy") }
        }
    }

    @Composable
    private fun Banner(text: String, color: Color) {
        Text(text, color = color, fontSize = 13.sp, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)
            .background(color.copy(alpha = 0.08f), RoundedCornerShape(10.dp)).padding(10.dp))
    }

    @Composable
    private fun Empty(text: String) {
        Text(text, color = Muted, fontSize = 14.sp, modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp, horizontal = 12.dp))
    }

    companion object {
        private val timeFmt = DateTimeFormatter.ofPattern("dd MMM, hh:mm a").withZone(ZoneId.of("Asia/Kolkata"))
        fun time(iso: String): String = runCatching { timeFmt.format(Instant.parse(iso)) }.getOrDefault(iso)

        /** UPI apps return e.g. "txnId=..&responseCode=00&Status=SUCCESS&ApprovalRefNo=526712345678". */
        fun extractUtr(response: String?): String? {
            if (response.isNullOrBlank()) return null
            val fields = response.split('&').mapNotNull { part ->
                val i = part.indexOf('=')
                if (i <= 0) null else part.substring(0, i).lowercase() to Uri.decode(part.substring(i + 1))
            }.toMap()
            if (fields["status"]?.equals("SUCCESS", ignoreCase = true) != true) return null
            return listOf("approvalrefno", "txnref", "utr", "rrn").firstNotNullOfOrNull { k ->
                fields[k]?.takeIf { Regex("^\\d{12}$").matches(it) }
            }
        }
    }
}
