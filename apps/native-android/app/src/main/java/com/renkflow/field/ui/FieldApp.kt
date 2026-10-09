@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.renkflow.field.ui

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.automirrored.outlined.Assignment
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.renkflow.field.R
import com.renkflow.field.FieldState
import com.renkflow.field.FieldViewModel
import com.renkflow.field.data.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable fun FieldApp(state: FieldState, model: FieldViewModel) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var operation by remember { mutableStateOf<Operation?>(null) }
    val writable = !state.updateRequired && !state.accessBlocked && state.snapshot?.permissions?.transition == true
    BackHandler(state.selectedId != null) { model.closeJob() }
    if (state.updateRequired) {
        Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(24.dp)) {
                Icon(Icons.Outlined.SystemUpdate, null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary)
                Text("Güncelleme gerekli", style = MaterialTheme.typography.headlineSmall)
                Text("Yeni RenkFlow Saha sürümünü kurun. Bekleyen işlemleriniz korunuyor.")
            }
        }
        return
    }
    if (state.restoring) {
        Box(Modifier.fillMaxSize().background(Ink), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Brand(); CircularProgressIndicator(color = OnInk)
            }
        }
        return
    }
    if (state.session == null) { Login(state, model); return }
    val tabs = listOf("Saha" to Icons.Outlined.SpaceDashboard, "İşler" to Icons.AutoMirrored.Outlined.Assignment, "Üretim" to Icons.Outlined.PrecisionManufacturing, "Tara" to Icons.Outlined.QrCodeScanner, "Hesap" to Icons.Outlined.PersonOutline)
    Scaffold(
        topBar = {
            TopAppBar(title = {
                Column { Text(if (state.selectedId != null) "İş emri" else "renkflow", fontWeight = FontWeight.Bold); if (state.selectedId == null) Text("SAHA", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary) }
            }, navigationIcon = { if (state.selectedId != null) IconButton(onClick = model::closeJob) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Geri") } },
                actions = { IconButton(onClick = model::refresh, enabled = !state.busy) { Icon(Icons.Outlined.Refresh, "Verileri yenile") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background))
        }, bottomBar = {
            NavigationBar { tabs.forEachIndexed { index, pair -> NavigationBarItem(selected = tab == index, onClick = { model.closeJob(); tab = index }, icon = { Icon(pair.second, null) }, label = { Text(pair.first) }) } }
        }
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
            if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            Column(Modifier.widthIn(max = 1000.dp).fillMaxWidth()) {
                if (state.error != null) Notice(state.error, true, model::dismiss)
                if (state.message != null) Notice(state.message, false, model::dismiss)
                SyncStatus(state, model)

            }
            Box(Modifier.widthIn(max = 1000.dp).weight(1f).fillMaxWidth()) {
                if (state.selectedId != null) {
                    state.detail?.let { JobDetail(it, state, writable, model, { operation = it }) }
                        ?: EmptyState("İş emri yükleniyor", "Bağlantıyı kontrol edip yenileyebilirsiniz.", Icons.AutoMirrored.Outlined.Assignment)
                } else when (tab) {
                    0 -> Home(state, { tab = 3 }, model::openJob, { operation = it })
                    1 -> Jobs(state.snapshot?.workOrders.orEmpty(), model::openJob)
                    2 -> Production(state, { operation = it })
                    3 -> Scan(state, model)
                    else -> Profile(state, model)
                }
            }
        }
    }
    operation?.let { op ->
        OperationSheet(op, state, writable, onDismiss = { operation = null }, onCommand = { model.command(it); operation = null }, upload = model::uploadPhoto)
    }
}

@Composable private fun SyncStatus(state: FieldState,model: FieldViewModel) {
    val pending=state.outbox.size
    val issue=state.outbox.firstOrNull {it.state in listOf("conflict","blocked","corrupt")}
    Surface(Modifier.padding(horizontal=20.dp,vertical=8.dp).fillMaxWidth(),shape=RoundedCornerShape(12.dp),color=MaterialTheme.colorScheme.surfaceVariant) {
        Row(Modifier.padding(12.dp).heightIn(min=56.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
            Icon(if(state.stale) Icons.Outlined.WifiOff else if(state.syncing || pending>0) Icons.Outlined.CloudUpload else Icons.Outlined.CloudDone,if(state.stale) "Çevrimdışı" else "Eşitleme durumu")
            Column(Modifier.weight(1f)) {
                Text(if(state.stale) "Çevrimdışı" else if(state.syncing) "Eşitleniyor" else "Eşitleme",fontWeight=FontWeight.SemiBold)
                state.lastSync?.let {Text(Instant.ofEpochMilli(it).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("HH:mm",Locale("tr"))),style=MaterialTheme.typography.labelMedium)}
            }
            if(pending>0) Badge(Modifier.semantics {contentDescription="$pending bekleyen işlem"}) {Text(pending.toString())}
            IconButton(onClick=model::sync,enabled=!state.syncing&&!state.updateRequired,modifier=Modifier.size(56.dp)) {Icon(Icons.Outlined.Sync,"Şimdi eşitle")}
        }
    }
    if(issue!=null) Card(Modifier.padding(horizontal=20.dp,vertical=4.dp).fillMaxWidth()) {
        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Text(if(issue.state=="conflict") "Sunucudaki kayıt değişmiş" else "İşlem uygulanamadı",fontWeight=FontWeight.SemiBold)
            Text(when(issue.kind) {"operation"->"Üretim bildirimi";"checklist"->"Kontrol listesi";"photo"->"Saha fotoğrafı";"transition"->"İş emri durumu";else->"Saha notu"},style=MaterialTheme.typography.labelLarge)
            Text(issue.reason.orEmpty(),style=MaterialTheme.typography.bodyMedium)
            Row(horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                if(issue.canRetry && issue.state=="conflict") Button(onClick={model.reapply(issue)},modifier=Modifier.heightIn(min=56.dp),enabled=!state.syncing&&!state.busy) {Text("Yine de uygula")}
                OutlinedButton(onClick={model.discard(issue)},modifier=Modifier.heightIn(min=56.dp),enabled=!state.syncing) {Text("Vazgeç")}
            }
        }
    }
}

@Composable private fun Brand() {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(color = OnInk, shape = RoundedCornerShape(8.dp)) { Icon(painterResource(R.drawable.ic_brand_mark), null, Modifier.padding(10.dp).size(28.dp), tint = Ink) }
        Column { Text("RenkFlow", color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.SemiBold); Text("SAHA UYGULAMASI", color = OnInk.copy(alpha = 0.65f), style = MaterialTheme.typography.labelSmall) }
    }
}

@Composable private fun Login(state: FieldState, model: FieldViewModel) {
    var server by rememberSaveable { mutableStateOf("https://renkflow.com") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var visible by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).systemBarsPadding().imePadding().verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally) {
        Column(Modifier.fillMaxWidth().background(Ink).padding(horizontal = 28.dp, vertical = 48.dp), verticalArrangement = Arrangement.spacedBy(28.dp)) {
            Brand()
            Text("Sahadaki işiniz.\nTek bir yerde.", color = Color.White, style = MaterialTheme.typography.headlineLarge)
            Text("İş emirleri, üretim adımları ve etiketler.\nRenkFlow hesabınızla devam edin.", color = Color(0xFF9A9AA3))
        }
        Column(Modifier.widthIn(max = 480.dp).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Hoş geldiniz", style = MaterialTheme.typography.headlineMedium)
            OutlinedTextField(server, { server = it }, Modifier.fillMaxWidth(), label = { Text("RenkFlow adresiniz") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri), singleLine = true, enabled = !state.busy)
            OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), label = { Text("E-posta") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), singleLine = true, enabled = !state.busy)
            OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), label = { Text("Şifre") }, visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(), trailingIcon = {
                IconButton(onClick = { visible = !visible }) { Icon(if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, if (visible) "Şifreyi gizle" else "Şifreyi göster") }
            }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), singleLine = true, enabled = !state.busy)
            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
            Button(onClick = { model.login(server, email, password) }, enabled = !state.busy && email.isNotBlank() && password.isNotEmpty(), modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp), shape = RoundedCornerShape(8.dp)) {
                if (state.busy) CircularProgressIndicator(Modifier.size(22.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp) else { Text("Giriş yap"); Spacer(Modifier.width(10.dp)); Icon(Icons.AutoMirrored.Outlined.ArrowForward, null) }
            }
            Text("Firmanızın mevcut RenkFlow hesabını kullanın.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable private fun Home(state: FieldState, scan: () -> Unit, open: (String) -> Unit, operation: (Operation) -> Unit) {
    val snapshot = state.snapshot
    val jobs = snapshot?.workOrders.orEmpty()
    val ops = snapshot?.operations.orEmpty()
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column { Text("İyi çalışmalar,", color = MaterialTheme.colorScheme.onSurfaceVariant); Text(state.session?.user?.name?.substringBefore(' ') ?: "RenkFlow", style = MaterialTheme.typography.headlineLarge) }
                Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.surfaceVariant) { Icon(Icons.Outlined.Engineering, null, Modifier.padding(15.dp).size(30.dp)) }
            }
        }
        item {
            Surface(color = Ink, shape = RoundedCornerShape(12.dp)) {
                Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text("BUGÜNÜN AKIŞI", color = OnInk, style = MaterialTheme.typography.labelMedium)
                    Text("İş hazır.\nSıra sizde.", color = Color.White, style = MaterialTheme.typography.headlineLarge)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(28.dp)) {
                        Metric(jobs.size.toString(), "Açık iş")
                        Metric(ops.count { it.status == "running" }.toString(), "Çalışan adım")
                        Metric(ops.count { it.status == "blocked" }.toString(), "Bloke")
                    }
                    Button(onClick = scan, colors = ButtonDefaults.buttonColors(containerColor = OnInk, contentColor = Ink), modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Icon(Icons.Outlined.QrCodeScanner, null); Spacer(Modifier.width(10.dp)); Text("Etiket tara") }
                }
            }
        }
        if (snapshot?.truncated == true) item { Text("Liste sınırına ulaşıldı. Etiket tarayarak belirli bir işe erişebilirsiniz.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
        item { SectionTitle("Sıradaki operasyonlar", "Başlatmak veya devam etmek için seçin") }
        val actionable = ops.filter { it.status in listOf("running", "ready", "paused", "blocked") }.take(4)
        if (actionable.isEmpty()) item { EmptyState("Hazır operasyon yok", "Size atanan yeni adımlar burada görünecek.", Icons.Outlined.TaskAlt) }
        items(actionable, key = { "op-${it.id}" }) { op -> OperationCard(op, jobs.firstOrNull { it.id == op.workOrderId }?.title, { operation(op) }) }
        item { SectionTitle("Öncelikli işler", "Açık iş emirleriniz") }
        items(jobs.take(5), key = { it.id }) { job -> JobCard(job) { open(job.id) } }
        if (jobs.isEmpty()) item { EmptyState("İş listeniz boş", "Atanan iş emirleri burada görünecek.", Icons.AutoMirrored.Outlined.Assignment) }
        snapshot?.let { item { Text("Son güncelleme ${displayDate(it.generatedAt)}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall) } }
    }
}
@Composable private fun Metric(value: String, label: String) { Column { Text(value, color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold); Text(label, color = Color(0xFF9A9AA3), style = MaterialTheme.typography.labelMedium) } }
@Composable private fun SectionTitle(title: String, caption: String) { Column(verticalArrangement = Arrangement.spacedBy(4.dp)) { Text(title, style = MaterialTheme.typography.titleLarge); Text(caption, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
@Composable private fun Jobs(jobs: List<WorkOrder>, open: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf("all") }
    val shown = jobs.filter { (filter == "all" || it.status == filter) && (it.title.contains(query, true) || it.location.orEmpty().contains(query, true)) }
    LazyVerticalGrid(columns = GridCells.Adaptive(320.dp), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        item(span = { GridItemSpan(maxLineSpan) }) { SectionTitle("İş emirleri", "Önceliğiniz ve bir sonraki adımınız") }
        item(span = { GridItemSpan(maxLineSpan) }) { OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), placeholder = { Text("İş veya konum ara") }, leadingIcon = { Icon(Icons.Outlined.Search, null) }, singleLine = true, shape = RoundedCornerShape(8.dp)) }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("all" to "Tümü", "open" to "Açık", "in_progress" to "Çalışan", "blocked" to "Bloke").forEach { (key, name) -> FilterChip(selected = filter == key, onClick = { filter = key }, label = { Text(name) }) } }
        }
        items(shown, key = { it.id }) { job -> JobCard(job) { open(job.id) } }
        if (shown.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) { EmptyState("Eşleşen iş yok", "Aramayı veya durum filtresini değiştirebilirsiniz.", Icons.Outlined.SearchOff) }
    }
}
@Composable private fun JobCard(job: WorkOrder, onClick: () -> Unit) {
    Card(onClick = onClick, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { StatusPill(job.status); Text(priorityLabel(job.priority), style = MaterialTheme.typography.labelMedium, color = if (job.priority in listOf("high", "critical")) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant) }
            Text(job.title, style = MaterialTheme.typography.titleMedium, maxLines = 3, overflow = TextOverflow.Ellipsis)
            job.color?.let { color ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val swatch = color.hex?.let { runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull() } ?: MaterialTheme.colorScheme.surfaceVariant
                    Box(Modifier.size(24.dp).background(swatch, RoundedCornerShape(4.dp)).semantics { contentDescription = color.label })
                    Text(color.label, style = MaterialTheme.typography.labelMedium)
                }
            }
            if (!job.location.isNullOrBlank()) Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Outlined.Place, null, Modifier.size(16.dp)); Spacer(Modifier.width(6.dp)); Text(job.location, style = MaterialTheme.typography.bodyMedium) }
            if (job.checklistTotal > 0) {
                LinearProgressIndicator(progress = { job.checklistCompleted.toFloat() / job.checklistTotal }, modifier = Modifier.fillMaxWidth().height(5.dp))
                Text("${job.checklistCompleted}/${job.checklistTotal} kontrol tamamlandı", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            job.dueAt?.let { Text("Termin ${displayDate(it)}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
    }
}
@Composable private fun StatusPill(status: String) {
    val color = when (status) { "blocked" -> MaterialTheme.colorScheme.error; "running", "in_progress" -> MaterialTheme.colorScheme.secondary; "done" -> MaterialTheme.colorScheme.tertiary; else -> MaterialTheme.colorScheme.onSurfaceVariant }
    Surface(color = color.copy(alpha = 0.12f), shape = RoundedCornerShape(8.dp)) { Text(statusLabel(status), Modifier.padding(horizontal = 10.dp, vertical = 6.dp), color = color, style = MaterialTheme.typography.labelMedium) }
}
@Composable private fun Production(state: FieldState, open: (Operation) -> Unit) {
    var activeOnly by rememberSaveable { mutableStateOf(true) }
    val ops = state.snapshot?.operations.orEmpty().filter { !activeOnly || it.status !in listOf("done", "cancelled") }
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { SectionTitle("Üretim adımları", "Her adımda güncel durum ve kalite kontrolü") }
        item { Row(verticalAlignment = Alignment.CenterVertically) { Text("Yalnızca açık adımlar", Modifier.weight(1f)); Switch(activeOnly, { activeOnly = it }) } }
        items(ops, key = { it.id }) { op -> OperationCard(op, state.snapshot?.workOrders?.firstOrNull { it.id == op.workOrderId }?.title) { open(op) } }
        if (ops.isEmpty()) item { EmptyState("Operasyon yok", "Atanan üretim adımları burada listelenir.", Icons.Outlined.PrecisionManufacturing) }
    }
}
@Composable private fun OperationCard(op: Operation, jobTitle: String?, click: () -> Unit) {
    Card(onClick = click, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("${(op.position + 1).toString().padStart(2, '0')} / ${op.workCenterCode.uppercase()}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant); StatusPill(op.status) }
            Text(op.name, style = MaterialTheme.typography.titleLarge)
            jobTitle?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            LinearProgressIndicator(progress = { (op.completedQty / op.plannedQty).toFloat().coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth())
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("${quantity(op.completedQty)} / ${quantity(op.plannedQty)} adet", style = MaterialTheme.typography.labelMedium); Text("${(op.activeSeconds / 60).toInt()} dk", style = MaterialTheme.typography.labelMedium) }
        }
    }
}

@Composable private fun JobDetail(job: WorkOrder, state: FieldState, writable: Boolean, model: FieldViewModel, operation: (Operation) -> Unit) {
    var note by rememberSaveable(job.id) { mutableStateOf("") }
    var blocking by remember { mutableStateOf(false) }
    var reason by remember { mutableStateOf("") }
    var confirmDone by remember { mutableStateOf(false) }
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { StatusPill(job.status) }
        item { Text(job.title, style = MaterialTheme.typography.headlineMedium) }
        job.description?.let { item { Text(it) } }
        item { Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) { Text(priorityLabel(job.priority), color = MaterialTheme.colorScheme.error); job.location?.let { Text(it) } } }
        job.blockedReasonDetail?.let { item { Notice(it, true) {} } }
        if (job.productionManaged) item { Text("Bu iş üretim adımları üzerinden ilerler.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        else if (state.snapshot?.permissions?.transition == true) item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (job.status in listOf("open", "blocked")) Button(onClick = { model.transition("in_progress") }, enabled = writable) { Text("İşi başlat") }
                if (job.status in listOf("open", "in_progress")) OutlinedButton(onClick = { blocking = true }, enabled = writable) { Text("Bloke bildir") }
                if (job.status == "in_progress" && state.snapshot.permissions.close) Button(onClick = { confirmDone = true }, enabled = writable) { Text("Tamamla") }
            }
        }
        item { SectionTitle("Kontrol listesi", "Zorunlu adımları doğrulayın") }
        items(job.checklist, key = { it.id }) { item ->
            Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.surface) {
                Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(item.completed, { model.checklist(item) }, enabled = writable && state.snapshot?.permissions?.checklist == true)
                    Column(Modifier.weight(1f)) { Text(item.title); if (item.required) Text("Zorunlu", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error) }
                }
            }
        }
        if (job.checklist.isEmpty()) item { Text("Bu işte kontrol listesi yok.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        items(state.snapshot?.operations.orEmpty().filter { it.workOrderId == job.id }, key = { "op-${it.id}" }) { op -> OperationCard(op, null) { operation(op) } }
        item { SectionTitle("Saha notları", "Ekibinizle aynı bilgide kalın") }
        items(job.comments, key = { "note-${it.id}" }) { comment ->
            Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.surface) { Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { Text(comment.body); Text("${comment.authorName ?: "Ekip"} · ${displayDate(comment.createdAt)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
        }
        if (state.snapshot?.permissions?.comment == true) item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(note, { if (it.length <= 2000) note = it }, Modifier.fillMaxWidth(), label = { Text("Saha notu ekle") }, minLines = 3)
                Button(onClick = { val submitted = note; model.comment(submitted) { if (note == submitted) note = "" } }, enabled = writable && note.isNotBlank()) { Text("Notu kaydet") }
            }
        }
    }
    if (blocking) AlertDialog(onDismissRequest = { blocking = false }, title = { Text("Bloke nedeni") }, text = { OutlinedTextField(reason, { reason = it }, label = { Text("Ne engelliyor?") }, minLines = 3) }, confirmButton = { TextButton(onClick = { model.transition("blocked", reason); blocking = false }, enabled = reason.trim().length in 5..1000 && writable) { Text("Bildir") } }, dismissButton = { TextButton(onClick = { blocking = false }) { Text("Vazgeç") } })
    if (confirmDone) AlertDialog(onDismissRequest = { confirmDone = false }, title = { Text("İş emri tamamlansın mı?") }, text = { Text("Kontrol listesi ve son durum sunucuda doğrulanacak.") }, confirmButton = { TextButton(onClick = { model.transition("done"); confirmDone = false }, enabled = writable) { Text("Tamamla") } }, dismissButton = { TextButton(onClick = { confirmDone = false }) { Text("Vazgeç") } })
}

@Composable private fun Scan(state: FieldState, model: FieldViewModel) {
    val context = LocalContext.current
    var code by rememberSaveable { mutableStateOf("") }
    var scanError by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        SectionTitle("Etiketten işe", "QR ve barkodları kamerayla okutun")
        Surface(color = Ink, shape = RoundedCornerShape(12.dp)) {
            Column(Modifier.fillMaxWidth().padding(36.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Icon(Icons.Outlined.QrCodeScanner, null, Modifier.size(100.dp), tint = OnInk)
                Text("Malzeme · Lot · İş emri", color = Color.White, style = MaterialTheme.typography.titleMedium)
                Button(onClick = {
                    scanError = null
                    val activity = context as? Activity ?: return@Button
                    GmsBarcodeScanning.getClient(activity, GmsBarcodeScannerOptions.Builder().enableAutoZoom().build()).startScan()
                        .addOnSuccessListener { it.rawValue?.let(model::scan) }
                        .addOnFailureListener { scanError = "Tarayıcı açılamadı. Kodu aşağıdan girebilirsiniz." }
                }, enabled = !state.busy, colors = ButtonDefaults.buttonColors(containerColor = OnInk, contentColor = Ink), modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) { Text("Kamerayı aç") }
            }
        }
        scanError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        OutlinedTextField(code, { if (it.length <= 1000) code = it }, Modifier.fillMaxWidth(), label = { Text("Etiket kodu") }, placeholder = { Text("Barkod veya QR içeriği") }, singleLine = true)
        OutlinedButton(onClick = { model.scan(code) }, enabled = code.isNotBlank() && !state.busy, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("Kodu bul") }
        state.scan?.let { result ->
            Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(labelKind(result.kind), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    Text(result.title, style = MaterialTheme.typography.titleLarge)
                    result.subtitle?.let { Text(it) }
                    result.quantity?.let { Text("${quantity(it)} ${result.uom.orEmpty()}") }
                    result.workOrderId?.let { id -> Button(onClick = { model.openJob(id) }) { Text("İş emrini aç") } }
                }
            }
        }
    }
}
@Composable private fun Profile(state: FieldState, model: FieldViewModel) {
    var logout by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        SectionTitle("Hesabınız", "RenkFlow Saha")
        Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
            Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(state.session?.user?.name ?: "RenkFlow", style = MaterialTheme.typography.titleLarge)
                Text(state.session?.user?.email.orEmpty())
                Text(when (state.session?.user?.role) { "worker" -> "Saha çalışanı"; "office" -> "Operasyon"; "owner" -> "Firma sahibi"; else -> "Yönetici" }, color = MaterialTheme.colorScheme.primary)
                HorizontalDivider()
                Text(state.session?.server.orEmpty(), style = MaterialTheme.typography.bodyMedium)
            }
        }
        Text("Üretim kayıtları firmanızın RenkFlow sistemine kaydedilir. Bağlantı kurulamadığında verileri yenileyin.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedButton(onClick = { logout = true }, enabled = !state.busy && state.pending == null, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Icon(Icons.AutoMirrored.Outlined.Logout, null); Spacer(Modifier.width(8.dp)); Text("Çıkış yap") }
        Text("Sürüm 1.0.0", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (logout) AlertDialog(onDismissRequest = { logout = false }, title = { Text("Çıkış yapılsın mı?") }, text = { Text("Bu cihazdaki oturumunuz temizlenecek.") }, confirmButton = { TextButton(onClick = { model.logout(); logout = false }) { Text("Çıkış yap") } }, dismissButton = { TextButton(onClick = { logout = false }) { Text("Vazgeç") } })
}

@Composable private fun OperationSheet(op: Operation, state: FieldState, writable: Boolean, onDismiss: () -> Unit, onCommand: (OperationInput) -> Unit, upload: (String, String, (String) -> Unit) -> Unit) {
    var count by rememberSaveable(op.id) { mutableStateOf(quantity(op.plannedQty - op.completedQty)) }
    var note by rememberSaveable(op.id) { mutableStateOf("") }
    val values = remember(op.id) { mutableStateMapOf<String, String>() }
    val passes = remember(op.id) { mutableStateMapOf<String, Boolean>() }
    var photo by rememberSaveable(op.id) { mutableStateOf<String?>(null) }
    var photoError by remember { mutableStateOf<String?>(null) }
    var confirm by remember { mutableStateOf(false) }
    var preparing by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) scope.launch {
            preparing = true; photoError = null
            try { val base64 = withContext(Dispatchers.IO) { photoBase64(context, uri) }; upload(op.workOrderId, base64) { photo = it } }
            catch (e: Exception) { photoError = e.message ?: "Fotoğraf hazırlanamadı." }
            finally { preparing = false }
        }
    }
    val validQuantity = count.toIntOrNull()?.let { it > 0 && it <= op.plannedQty - op.completedQty } == true
    val qualityValid = op.qualityChecks.all { check -> when (check.kind) { "pass_fail" -> passes.containsKey(check.id); "measurement" -> values[check.id]?.replace(',', '.')?.toDoubleOrNull()?.isFinite() == true; "photo" -> photo != null; else -> false } }
    val canWrite = writable && !preparing && (state.session?.user?.role != "worker" || op.assignedTo == state.session.user.id)
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().imePadding().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            StatusPill(op.status)
            Text(op.name, style = MaterialTheme.typography.headlineMedium)
            Text("${op.workCenterCode} · ${quantity(op.completedQty)} / ${quantity(op.plannedQty)} adet", color = MaterialTheme.colorScheme.onSurfaceVariant)
            op.reason?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            if (op.status in listOf("ready", "paused", "blocked")) Button(onClick = { onCommand(OperationInput(op.id, op.version, "start")) }, enabled = canWrite, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) { Icon(Icons.Outlined.PlayArrow, null); Text("Üretimi başlat") }
            if (op.status == "running") {
                OutlinedButton(onClick = { onCommand(OperationInput(op.id, op.version, "pause")) }, enabled = canWrite, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Outlined.Pause, null); Text("Duraklat") }
                OutlinedTextField(count, { count = it }, Modifier.fillMaxWidth(), label = { Text("Tamamlanan adet") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true)
                op.qualityChecks.forEach { check ->
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(check.name, fontWeight = FontWeight.SemiBold)
                        when (check.kind) {
                            "pass_fail" -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { FilterChip(passes[check.id] == true, { passes[check.id] = true }, label = { Text("Geçti") }); FilterChip(passes[check.id] == false, { passes[check.id] = false }, label = { Text("Kaldı") }) }
                            "measurement" -> { Text("${check.minimum} – ${check.maximum} ${check.unit}", style = MaterialTheme.typography.labelMedium); OutlinedTextField(values[check.id].orEmpty(), { values[check.id] = it }, Modifier.fillMaxWidth(), label = { Text("Ölçüm (${check.unit})") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true) }
                            "photo" -> Text("Yeni fotoğraf gerekli", color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
                OutlinedButton(onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, enabled = canWrite) { Icon(Icons.Outlined.AddPhotoAlternate, null); Spacer(Modifier.width(8.dp)); Text(if (photo != null) "Fotoğraf yüklendi ✓" else "Fotoğraf ekle") }
                photoError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                OutlinedTextField(note, { if (it.length <= 2000) note = it }, Modifier.fillMaxWidth(), label = { Text("Üretim notu (isteğe bağlı)") }, minLines = 2)
                Button(onClick = { confirm = true }, enabled = canWrite && validQuantity && qualityValid, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) { Text("Tamamlanan miktarı kaydet") }
            }
            if (op.status in listOf("waiting", "done", "cancelled")) Text(when (op.status) { "waiting" -> "Önceki adımlar tamamlandığında bu operasyon hazır olacak."; "done" -> "Bu adım tamamlandı."; else -> "Bu operasyon iptal edilmiş." }, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(12.dp))
        }
    }
    if (confirm) AlertDialog(onDismissRequest = { confirm = false }, title = { Text("$count adet kaydedilsin mi?") }, text = { Text("Kalite sonuçları sunucuda kontrol edilecek. Başarısız kontrol operasyonu bloke eder.") }, confirmButton = { TextButton(onClick = {
        val results = op.qualityChecks.map { QualityResult(it.id, if (it.kind == "pass_fail") passes[it.id] else if (it.kind == "photo") true else null, if (it.kind == "measurement") values[it.id]?.replace(',', '.')?.toDoubleOrNull() else null) }
        onCommand(OperationInput(op.id, op.version, "complete", count.toInt(), note.takeIf { it.isNotBlank() }, results, listOfNotNull(photo)))
        confirm = false
    }, enabled = canWrite && validQuantity && qualityValid) { Text("Kaydet") } }, dismissButton = { TextButton(onClick = { confirm = false }) { Text("Vazgeç") } })
}

@Composable private fun Notice(text: String, error: Boolean, dismiss: () -> Unit) {
    Surface(Modifier.padding(horizontal = 20.dp, vertical = 6.dp).fillMaxWidth(), shape = RoundedCornerShape(12.dp), color = if (error) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.secondaryContainer) {
        Row(Modifier.padding(start = 16.dp), verticalAlignment = Alignment.CenterVertically) { Text(text, Modifier.weight(1f).padding(vertical = 12.dp), style = MaterialTheme.typography.bodyMedium); IconButton(onClick = dismiss) { Icon(Icons.Outlined.Close, "Bildirimi kapat") } }
    }
}
@Composable private fun EmptyState(title: String, subtitle: String, icon: ImageVector) {
    Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) { Icon(icon, null, Modifier.size(40.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant); Text(title, style = MaterialTheme.typography.titleMedium); Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
}
private fun quantity(value: Double): String = if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()
private fun displayDate(value: String): String = runCatching { DateTimeFormatter.ofPattern("d MMM, HH:mm", Locale.forLanguageTag("tr-TR")).withZone(ZoneId.systemDefault()).format(Instant.parse(value)) }.getOrElse { value.take(10) }
private fun labelKind(kind: String) = when (kind) { "job" -> "İş emri"; "item" -> "Malzeme"; "lot" -> "Lot"; "location" -> "Konum"; "product" -> "Mamul"; "cut" -> "Kesim paketi"; else -> "Etiket" }
