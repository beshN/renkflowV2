@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.renkflow.field.ui

import com.renkflow.field.data.tr
import com.renkflow.field.data.tr
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
    val appLock by FieldAppLock.state.collectAsState()
    val activity=androidx.activity.compose.LocalActivity.current as? androidx.fragment.app.FragmentActivity
    if(state.session!=null && appLock.enabled && !appLock.unlocked) {
        Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center) {
            Column(Modifier.padding(24.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(20.dp)) {
                Icon(Icons.Outlined.Lock,tr(R.string.text_uygulama_kilitli_3853e),Modifier.size(56.dp))
                Text(tr(R.string.text_renkflow_saha_671f9),style=MaterialTheme.typography.headlineMedium)
                appLock.message?.let {Text(it)}
                Button(onClick={activity?.let {FieldAppLock.unlock(it)}},modifier=Modifier.heightIn(min=56.dp)) {Text(tr(R.string.text_kilidi_ac_5ff1b))}
            }
        };return
    }
    val view=androidx.compose.ui.platform.LocalView.current
    LaunchedEffect(state.message,state.error) {
        if(state.error!=null) view.performHapticFeedback(if(android.os.Build.VERSION.SDK_INT>=30) android.view.HapticFeedbackConstants.REJECT else android.view.HapticFeedbackConstants.LONG_PRESS)
        else if(state.message!=null) view.performHapticFeedback(if(android.os.Build.VERSION.SDK_INT>=30) android.view.HapticFeedbackConstants.CONFIRM else android.view.HapticFeedbackConstants.LONG_PRESS)
    }
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var operation by remember { mutableStateOf<Operation?>(null) }
    var installations by remember {mutableStateOf(false)}
    val writable = !state.updateRequired && !state.accessBlocked && state.snapshot?.permissions?.transition == true
    BackHandler(state.selectedId != null) { model.closeJob() }
    if (state.updateRequired) {
        Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(24.dp)) {
                Icon(Icons.Outlined.SystemUpdate, null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary)
                Text(tr(R.string.text_guncelleme_gerekli_089dc), style = MaterialTheme.typography.headlineSmall)
                Text(tr(R.string.text_yeni_renkflow_saha_surumunu_kurun_bekleyen_islem_61fc9))
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
    val tabs=listOf(Triple(0,tr(R.string.text_saha_2ee48),Icons.Outlined.SpaceDashboard),Triple(1,tr(R.string.text_isler_fd39e),Icons.AutoMirrored.Outlined.Assignment),Triple(2,tr(R.string.text_uretim_0d3d1),Icons.Outlined.PrecisionManufacturing),Triple(3,tr(R.string.text_tara_11607),Icons.Outlined.QrCodeScanner),Triple(4,tr(R.string.text_hesap_1c56a),Icons.Outlined.PersonOutline)).filter {it.first !in listOf(1,2) || state.references?.capabilities?.productionView!=false}
    Scaffold(
        topBar = {
            TopAppBar(title = {
                Column { Text(if (state.selectedId != null) tr(R.string.text_is_emri_10fe2) else "renkflow", fontWeight = FontWeight.Bold); if (state.selectedId == null) Text(tr(R.string.text_saha_dbfb0), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary) }
            }, navigationIcon = { if (state.selectedId != null) IconButton(modifier=Modifier.size(56.dp),onClick = model::closeJob) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, tr(R.string.text_geri_b68a3)) } },
                actions = { IconButton(modifier=Modifier.size(56.dp),onClick = model::refresh, enabled = !state.busy) { Icon(Icons.Outlined.Refresh, tr(R.string.text_verileri_yenile_1db09)) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background))
        }, bottomBar = {
            NavigationBar { tabs.forEach { (index,title,icon) -> NavigationBarItem(selected = tab == index, onClick = { model.closeJob(); tab = index }, icon = { Icon(icon, null) }, label = { Text(title) }) } }
        }
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
            if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            Column(Modifier.widthIn(max = 1000.dp).fillMaxWidth()) {
                if (state.error != null) Notice(state.error, true, model::dismiss)
                if (state.message != null) Notice(state.message, false, model::dismiss)
                SyncStatus(state, model)

            }
            BoxWithConstraints(Modifier.widthIn(max = 1000.dp).weight(1f).fillMaxWidth()) {
                if(tab==1 && maxWidth>=840.dp) {
                    Row(Modifier.fillMaxSize()) {
                        Box(Modifier.width(320.dp).fillMaxHeight()) {Jobs(state.snapshot?.workOrders.orEmpty(),model::openJob)}
                        VerticalDivider()
                        Box(Modifier.weight(1f).fillMaxHeight()) {state.detail?.let {JobDetail(it,state,writable,model,{operation=it})} ?: EmptyState(tr(R.string.text_is_emri_yukleniyor_adba4),tr(R.string.text_baglantiyi_kontrol_edip_yenileyebilirsiniz_c97fa),Icons.AutoMirrored.Outlined.Assignment)}
                    }
                } else if (state.selectedId != null) {
                    state.detail?.let { JobDetail(it, state, writable, model, { operation = it }) }
                        ?: EmptyState(tr(R.string.text_is_emri_yukleniyor_adba4), tr(R.string.text_baglantiyi_kontrol_edip_yenileyebilirsiniz_c97fa), Icons.AutoMirrored.Outlined.Assignment)
                } else when (tab) {
                    0 -> Home(state, { tab = 3 }, model::openJob, { operation = it },{installations=true})
                    1 -> Jobs(state.snapshot?.workOrders.orEmpty(), model::openJob)
                    2 -> Production(state, { operation = it },model::openJob)
                    3 -> Scan(state, model)
                    else -> Profile(state, model)
                }
            }
        }
    }
    if(installations) InstallationView(state,model) {installations=false}
    operation?.let { op ->
        OperationSheet(op, state, writable, onDismiss = { operation = null }, onCommand = { model.command(it); operation = null }, upload = model::uploadPhoto)
    }
}

@Composable private fun SyncStatus(state: FieldState,model: FieldViewModel) {
    val pending=state.outbox.size
    val issue=state.outbox.firstOrNull {it.state in listOf("conflict","blocked","corrupt")}
    Surface(Modifier.padding(horizontal=20.dp,vertical=8.dp).fillMaxWidth(),shape=RoundedCornerShape(12.dp),color=MaterialTheme.colorScheme.surfaceVariant) {
        Row(Modifier.padding(12.dp).heightIn(min=56.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
            Icon(if(state.stale) Icons.Outlined.WifiOff else if(state.syncing || pending>0) Icons.Outlined.CloudUpload else Icons.Outlined.CloudDone,if(state.stale) tr(R.string.text_cevrimdisi_47108) else tr(R.string.text_esitleme_durumu_ab6d6))
            Column(Modifier.weight(1f)) {
                Text(if(state.stale) tr(R.string.text_cevrimdisi_47108) else if(state.syncing) tr(R.string.text_esitleniyor_b1a3a) else tr(R.string.text_esitleme_30651),fontWeight=FontWeight.SemiBold)
                state.lastSync?.let {Text(Instant.ofEpochMilli(it).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("HH:mm",Locale("tr"))),style=MaterialTheme.typography.labelMedium)}
            }
            if(pending>0) {
                Badge(Modifier.semantics {contentDescription=tr(R.string.text_1_bekleyen_islem_c7f26, pending)}) {Text(pending.toString())}
            }
            IconButton(onClick=model::sync,enabled=!state.syncing&&!state.updateRequired,modifier=Modifier.size(56.dp)) {Icon(Icons.Outlined.Sync,tr(R.string.text_simdi_esitle_f9e46))}
        }
    }
    if(issue!=null) Card(Modifier.padding(horizontal=20.dp,vertical=4.dp).fillMaxWidth()) {
        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Text(if(issue.state=="conflict") tr(R.string.text_sunucudaki_kayit_degismis_8ac59) else tr(R.string.text_islem_uygulanamadi_33a9a),fontWeight=FontWeight.SemiBold)
            Text(when(issue.kind) {"operation"->tr(R.string.text_uretim_bildirimi_ee55b);"checklist"->tr(R.string.text_kontrol_listesi_4914c);"photo"->tr(R.string.text_saha_fotografi_655b0);"transition"->tr(R.string.text_is_emri_durumu_3ea60);else->tr(R.string.text_saha_notu_10e6a)},style=MaterialTheme.typography.labelLarge)
            Text(issue.reason.orEmpty(),style=MaterialTheme.typography.bodyMedium)
            Row(horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                if(issue.canRetry && issue.state=="conflict") Button(onClick={model.reapply(issue)},modifier=Modifier.heightIn(min=56.dp),enabled=!state.syncing&&!state.busy) {Text(tr(R.string.text_yine_de_uygula_4e5b5))}
                OutlinedButton(onClick={model.discard(issue)},modifier=Modifier.heightIn(min=56.dp),enabled=!state.syncing) {Text(tr(R.string.text_vazgec_39a8d))}
            }
        }
    }
}

@Composable private fun Brand() {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(color = OnInk, shape = RoundedCornerShape(8.dp)) { Icon(painterResource(R.drawable.ic_brand_mark), null, Modifier.padding(10.dp).size(28.dp), tint = Ink) }
        Column { Text(tr(R.string.text_renkflow_6ac42), color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.SemiBold); Text(tr(R.string.text_saha_uygulamasi_30117), color = OnInk.copy(alpha = 0.65f), style = MaterialTheme.typography.labelSmall) }
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
            Text(tr(R.string.text_sahadaki_isiniz_tek_bir_yerde_1f831), color = Color.White, style = MaterialTheme.typography.headlineLarge)
            Text(tr(R.string.text_is_emirleri_uretim_adimlari_ve_etiketler_renkflo_b3d7b), color = Color(0xFF9A9AA3))
        }
        Column(Modifier.widthIn(max = 480.dp).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(tr(R.string.text_hos_geldiniz_0534d), style = MaterialTheme.typography.headlineMedium)
            OutlinedTextField(server, { server = it }, Modifier.fillMaxWidth(), label = { Text(tr(R.string.text_renkflow_adresiniz_4553a)) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri), singleLine = true, enabled = !state.busy)
            OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), label = { Text("E-posta") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), singleLine = true, enabled = !state.busy)
            OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), label = { Text(tr(R.string.text_sifre_e1ac9)) }, visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(), trailingIcon = {
                IconButton(modifier=Modifier.size(56.dp),onClick = { visible = !visible }) { Icon(if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, if (visible) tr(R.string.text_sifreyi_gizle_73202) else tr(R.string.text_sifreyi_goster_8102f)) }
            }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), singleLine = true, enabled = !state.busy)
            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
            Button(onClick = { model.login(server, email, password) }, enabled = !state.busy && email.isNotBlank() && password.isNotEmpty(), modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp), shape = RoundedCornerShape(8.dp)) {
                if (state.busy) CircularProgressIndicator(Modifier.size(22.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp) else { Text(tr(R.string.text_giris_yap_b872b)); Spacer(Modifier.width(10.dp)); Icon(Icons.AutoMirrored.Outlined.ArrowForward, null) }
            }
            Text(tr(R.string.text_firmanizin_mevcut_renkflow_hesabini_kullanin_32cc2), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable private fun Home(state: FieldState, scan: () -> Unit, open: (String) -> Unit, operation: (Operation) -> Unit,installations:()->Unit) {
    val snapshot = state.snapshot
    val jobs = snapshot?.workOrders.orEmpty()
    val ops = snapshot?.operations.orEmpty()
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column { Text(tr(R.string.text_iyi_calismalar_c024d), color = MaterialTheme.colorScheme.onSurfaceVariant); Text(state.session?.user?.name?.substringBefore(' ') ?: tr(R.string.text_renkflow_6ac42), style = MaterialTheme.typography.headlineLarge) }
                Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.surfaceVariant) { Icon(Icons.Outlined.Engineering, null, Modifier.padding(15.dp).size(30.dp)) }
            }
        }
        item {
            Surface(color = Ink, shape = RoundedCornerShape(12.dp)) {
                Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(tr(R.string.text_bugunun_akisi_e3c32), color = OnInk, style = MaterialTheme.typography.labelMedium)
                    Text(tr(R.string.text_is_hazir_sira_sizde_a7bfe), color = Color.White, style = MaterialTheme.typography.headlineLarge)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(28.dp)) {
                        Metric(jobs.size.toString(), tr(R.string.text_acik_is_709f6))
                        Metric(ops.count { it.status == "running" }.toString(), tr(R.string.text_calisan_adim_a84f5))
                        Metric(ops.count { it.status == "blocked" }.toString(), tr(R.string.text_bloke_9e16b))
                    }
                    Button(onClick = scan, colors = ButtonDefaults.buttonColors(containerColor = OnInk, contentColor = Ink), modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) { Icon(Icons.Outlined.QrCodeScanner, null); Spacer(Modifier.width(10.dp)); Text(tr(R.string.text_etiket_tara_658b9)) }
                }
            }
        }
        if (snapshot?.truncated == true) item { Text(tr(R.string.text_liste_sinirina_ulasildi_etiket_tarayarak_belirli_7e7b6), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
        if(state.references?.capabilities?.installations==true) item {OutlinedButton(onClick=installations,modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text(tr(R.string.text_montaj_ekibi_isleri_418a5))}}
        item { SectionTitle(tr(R.string.text_siradaki_operasyonlar_99c52), tr(R.string.text_baslatmak_veya_devam_etmek_icin_secin_393a8)) }
        val actionable = ops.filter { it.status in listOf("running", "ready", "paused", "blocked") }.take(4)
        if (actionable.isEmpty()) item { EmptyState(tr(R.string.text_hazir_operasyon_yok_c826f), tr(R.string.text_size_atanan_yeni_adimlar_burada_gorunecek_1109f), Icons.Outlined.TaskAlt) }
        items(actionable, key = { "op-${it.id}" }) { op -> OperationCard(op, jobs.firstOrNull { it.id == op.workOrderId }?.title, { operation(op) }) }
        item { SectionTitle(tr(R.string.text_oncelikli_isler_2c513), tr(R.string.text_acik_is_emirleriniz_015d7)) }
        items(jobs.take(5), key = { it.id }) { job -> JobCard(job) { open(job.id) } }
        if (jobs.isEmpty()) item { EmptyState(tr(R.string.text_is_listeniz_bos_de4a8), tr(R.string.text_atanan_is_emirleri_burada_gorunecek_492b5), Icons.AutoMirrored.Outlined.Assignment) }
        snapshot?.let { item { Text(tr(R.string.text_son_guncelleme_1_488f0, displayDate(it.generatedAt)), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall) } }
    }
}
@Composable private fun Metric(value: String, label: String) { Column { Text(value, color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold); Text(label, color = Color(0xFF9A9AA3), style = MaterialTheme.typography.labelMedium) } }
@Composable private fun SectionTitle(title: String, caption: String) { Column(verticalArrangement = Arrangement.spacedBy(4.dp)) { Text(title, style = MaterialTheme.typography.titleLarge); Text(caption, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
@Composable private fun Jobs(jobs: List<WorkOrder>, open: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf("all") }
    val shown = jobs.filter { (filter == "all" || it.status == filter) && (it.title.contains(query, true) || it.location.orEmpty().contains(query, true)) }
    LazyVerticalGrid(columns = GridCells.Adaptive(320.dp), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        item(span = { GridItemSpan(maxLineSpan) }) { SectionTitle(tr(R.string.text_is_emirleri_d8461), tr(R.string.text_onceliginiz_ve_bir_sonraki_adiminiz_6f665)) }
        item(span = { GridItemSpan(maxLineSpan) }) { OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), placeholder = { Text(tr(R.string.text_is_veya_konum_ara_ad84a)) }, leadingIcon = { Icon(Icons.Outlined.Search, null) }, singleLine = true, shape = RoundedCornerShape(8.dp)) }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("all" to tr(R.string.text_tumu_f43a6), "open" to tr(R.string.text_acik_bbb11), "in_progress" to tr(R.string.text_calisan_0f548), "blocked" to tr(R.string.text_bloke_9e16b)).forEach { (key, name) -> FilterChip(selected = filter == key, onClick = { filter = key }, label = { Text(name) }) } }
        }
        items(shown, key = { it.id }) { job -> JobCard(job) { open(job.id) } }
        if (shown.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) { EmptyState(tr(R.string.text_eslesen_is_yok_3f481), tr(R.string.text_aramayi_veya_durum_filtresini_degistirebilirsini_d6ed2), Icons.Outlined.SearchOff) }
    }
}
@Composable private fun JobCard(job: WorkOrder, onClick: () -> Unit) {
    Card(onClick = onClick, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { StatusPill(job.status); Text(priorityLabel(job.priority), style = MaterialTheme.typography.labelMedium, color = if (job.priority in listOf("high", "critical")) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant) }
            FamilyThumbnail(job.productFamily)
            Text(job.title, style = MaterialTheme.typography.titleMedium, maxLines = 3, overflow = TextOverflow.Ellipsis)
            job.color?.let { color ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val swatch = color.hex?.let { runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull() } ?: MaterialTheme.colorScheme.surfaceVariant
                    Box(Modifier.size(24.dp).background(swatch, RoundedCornerShape(4.dp)).semantics { contentDescription = color.label })
                    Column {Text(color.code, style = MaterialTheme.typography.labelMedium);color.finish?.let {Text(it,style=MaterialTheme.typography.labelSmall)}}
                }
            }
            if (!job.location.isNullOrBlank()) Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Outlined.Place, null, Modifier.size(16.dp)); Spacer(Modifier.width(6.dp)); Text(job.location, style = MaterialTheme.typography.bodyMedium) }
            if (job.checklistTotal > 0) {
                LinearProgressIndicator(progress = { job.checklistCompleted.toFloat() / job.checklistTotal }, modifier = Modifier.fillMaxWidth().height(5.dp))
                Text(tr(R.string.text_1_2_kontrol_tamamlandi_a91af, job.checklistCompleted, job.checklistTotal), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            job.dueAt?.let { Text("Termin ${displayDate(it)}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
    }
}
@Composable private fun StatusPill(status: String) {
    val color = when (status) { "blocked" -> MaterialTheme.colorScheme.error; "running", "in_progress" -> MaterialTheme.colorScheme.secondary; "done" -> MaterialTheme.colorScheme.tertiary; else -> MaterialTheme.colorScheme.onSurfaceVariant }
    Surface(color = color.copy(alpha = 0.12f), shape = RoundedCornerShape(8.dp)) { Text(statusLabel(status), Modifier.padding(horizontal = 10.dp, vertical = 6.dp), color = color, style = MaterialTheme.typography.labelMedium) }
}
@Composable private fun Production(state: FieldState, open: (Operation) -> Unit,openJob:(String)->Unit) {
    var activeOnly by rememberSaveable { mutableStateOf(true) }
    val ops = state.snapshot?.operations.orEmpty().filter { !activeOnly || it.status !in listOf("done", "cancelled") }
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { SectionTitle(tr(R.string.text_uretim_adimlari_8d861), tr(R.string.text_her_adimda_guncel_durum_ve_kalite_kontrolu_8de56)) }
        item {CuttingPlans(state.snapshot?.cutPlans.orEmpty(),state.snapshot?.workOrders.orEmpty(),openJob)}
        item { Row(verticalAlignment = Alignment.CenterVertically) { Text(tr(R.string.text_yalnizca_acik_adimlar_5fe29), Modifier.weight(1f)); Switch(activeOnly, { activeOnly = it }) } }
        items(ops, key = { it.id }) { op -> OperationCard(op, state.snapshot?.workOrders?.firstOrNull { it.id == op.workOrderId }?.title) { open(op) } }
        if (ops.isEmpty()) item { EmptyState(tr(R.string.text_operasyon_yok_29cac), tr(R.string.text_atanan_uretim_adimlari_burada_listelenir_64aed), Icons.Outlined.PrecisionManufacturing) }
    }
}
@Composable private fun OperationCard(op: Operation, jobTitle: String?, click: () -> Unit) {
    Card(onClick = click, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("${(op.position + 1).toString().padStart(2, '0')} / ${op.workCenterCode.uppercase()}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant); StatusPill(op.status) }
            Text(op.name, style = MaterialTheme.typography.titleLarge)
            jobTitle?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(16.dp)) {
                Box(contentAlignment=Alignment.Center,modifier=Modifier.size(72.dp).semantics {contentDescription=tr(R.string.text_1_kalan_adet_4640a, quantity(op.plannedQty-op.completedQty))}) {
                    CircularProgressIndicator(progress={if(op.plannedQty>0) (op.completedQty/op.plannedQty).toFloat().coerceIn(0f,1f) else 0f},modifier=Modifier.fillMaxSize(),strokeWidth=6.dp)
                    Text(quantity(op.plannedQty-op.completedQty),fontWeight=FontWeight.Bold)
                }
                Button(onClick=click,modifier=Modifier.weight(1f).heightIn(min=56.dp)) {Text(if(op.status=="running") "Duraklat / Bitti" else if(op.status in listOf("ready","paused","blocked")) tr(R.string.text_basla_788ed) else statusLabel(op.status))}
            }
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
        if (job.productionManaged) item { Text(tr(R.string.text_bu_is_uretim_adimlari_uzerinden_ilerler_e8d59), color = MaterialTheme.colorScheme.onSurfaceVariant) }
        else if (state.snapshot?.permissions?.transition == true) item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (job.status in listOf("open", "blocked")) Button(onClick = { model.transition("in_progress") }, enabled = writable) { Text(tr(R.string.text_isi_baslat_50c33)) }
                if (job.status in listOf("open", "in_progress")) OutlinedButton(onClick = { blocking = true }, enabled = writable) { Text(tr(R.string.text_bloke_bildir_aa95a)) }
                if (job.status == "in_progress" && state.snapshot.permissions.close) Button(onClick = { confirmDone = true }, enabled = writable) { Text(tr(R.string.text_tamamla_d95ff)) }
            }
        }
        item {CuttingPlans(state.snapshot?.cutPlans.orEmpty().filter {it.bars.any {bar->bar.pieces.any {p->p.workOrderId==job.id}}},state.snapshot?.workOrders.orEmpty(),model::openJob)}
        item {FieldEventView(state.references,writable,save={kind,code,count,note,photo->model.fieldEvent(kind,job.id,code,count,note,photo)},upload={bytes,done->model.uploadPhoto(job.id,bytes,done)})}
        item { SectionTitle(tr(R.string.text_kontrol_listesi_4914c), tr(R.string.text_zorunlu_adimlari_dogrulayin_5c79a)) }
        items(job.checklist, key = { it.id }) { item ->
            Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.surface) {
                Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(item.completed, { model.checklist(item) }, enabled = writable && state.snapshot?.permissions?.checklist == true)
                    Column(Modifier.weight(1f)) { Text(item.title); if (item.required) Text(tr(R.string.text_zorunlu_a0394), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error) }
                }
            }
        }
        if (job.checklist.isEmpty()) item { Text(tr(R.string.text_bu_iste_kontrol_listesi_yok_4adbe), color = MaterialTheme.colorScheme.onSurfaceVariant) }
        items(state.snapshot?.operations.orEmpty().filter { it.workOrderId == job.id }, key = { "op-${it.id}" }) { op -> OperationCard(op, null) { operation(op) } }
        item { SectionTitle(tr(R.string.text_saha_notlari_7d9a6), tr(R.string.text_ekibinizle_ayni_bilgide_kalin_51b74)) }
        items(job.comments, key = { "note-${it.id}" }) { comment ->
            Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.surface) { Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { Text(comment.body); Text("${comment.authorName ?: "Ekip"} · ${displayDate(comment.createdAt)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
        }
        if (state.snapshot?.permissions?.comment == true) item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(note, { if (it.length <= 2000) note = it }, Modifier.fillMaxWidth(), label = { Text(tr(R.string.text_saha_notu_ekle_e9d60)) }, minLines = 3)
                Button(onClick = { val submitted = note; model.comment(submitted) { if (note == submitted) note = "" } }, enabled = writable && note.isNotBlank()) { Text(tr(R.string.text_notu_kaydet_04416)) }
            }
        }
    }
    if (blocking) AlertDialog(onDismissRequest = { blocking = false }, title = { Text(tr(R.string.text_bloke_nedeni_345e2)) }, text = { OutlinedTextField(reason, { reason = it }, label = { Text(tr(R.string.text_ne_engelliyor_09dfe)) }, minLines = 3) }, confirmButton = { TextButton(onClick = { model.transition("blocked", reason); blocking = false }, enabled = reason.trim().length in 5..1000 && writable) { Text(tr(R.string.text_bildir_d3eb3)) } }, dismissButton = { TextButton(onClick = { blocking = false }) { Text(tr(R.string.text_vazgec_39a8d)) } })
    if (confirmDone) AlertDialog(onDismissRequest = { confirmDone = false }, title = { Text(tr(R.string.text_is_emri_tamamlansin_mi_07980)) }, text = { Text(tr(R.string.text_kontrol_listesi_ve_son_durum_sunucuda_dogrulanac_f8705)) }, confirmButton = { TextButton(onClick = { model.transition("done"); confirmDone = false }, enabled = writable) { Text(tr(R.string.text_tamamla_d95ff)) } }, dismissButton = { TextButton(onClick = { confirmDone = false }) { Text(tr(R.string.text_vazgec_39a8d)) } })
}

@Composable private fun Scan(state: FieldState, model: FieldViewModel) {
    val context = LocalContext.current
    var code by rememberSaveable { mutableStateOf("") }
    var scanning by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        SectionTitle(tr(R.string.text_etiketten_ise_84575), tr(R.string.text_qr_ve_barkodlari_kamerayla_okutun_109c6))
        Surface(color = Ink, shape = RoundedCornerShape(12.dp)) {
            Column(Modifier.fillMaxWidth().padding(36.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Icon(Icons.Outlined.QrCodeScanner, null, Modifier.size(100.dp), tint = OnInk)
                Text(tr(R.string.text_malzeme_lot_is_emri_92ca4), color = Color.White, style = MaterialTheme.typography.titleMedium)
                Button(onClick = {
                    scanning = true
                }, enabled = !state.busy, colors = ButtonDefaults.buttonColors(containerColor = OnInk, contentColor = Ink), modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) { Text(tr(R.string.text_kamerayi_ac_837ff)) }
            }
        }
        if(scanning) CameraScanner(close={scanning=false}) {value -> scanning=false;code=value;model.scan(value)}
        OutlinedTextField(code, { if (it.length <= 1000) code = it }, Modifier.fillMaxWidth(), label = { Text(tr(R.string.text_etiket_kodu_e9c0f)) }, placeholder = { Text(tr(R.string.text_barkod_veya_qr_icerigi_01549)) }, singleLine = true)
        OutlinedButton(onClick = { model.scan(code) }, enabled = code.isNotBlank() && !state.busy, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) { Text(tr(R.string.text_kodu_bul_172a4)) }
        state.scan?.let { result ->
            Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(labelKind(result.kind), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    Text(result.title, style = MaterialTheme.typography.titleLarge)
                    result.subtitle?.let { Text(it) }
                    result.quantity?.let { Text("${quantity(it)} ${result.uom.orEmpty()}") }
                    result.workOrderId?.let { id -> Button(onClick = { model.openJob(id) }) { Text(tr(R.string.text_is_emrini_ac_516de)) } }
                }
            }
        }
    }
}
@Composable private fun Profile(state: FieldState, model: FieldViewModel) {
    val lock by FieldAppLock.state.collectAsState()
    val context=LocalContext.current
    val activity=androidx.activity.compose.LocalActivity.current as? androidx.fragment.app.FragmentActivity
    var logout by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        SectionTitle(tr(R.string.text_hesabiniz_91e78), tr(R.string.text_renkflow_saha_671f9))
        Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
            Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(state.session?.user?.name ?: tr(R.string.text_renkflow_6ac42), style = MaterialTheme.typography.titleLarge)
                Text(state.session?.user?.email.orEmpty())
                Text(when (state.session?.user?.role) { "worker" -> tr(R.string.text_saha_calisani_931cb); "office" -> tr(R.string.text_operasyon_fc6e7); "owner" -> tr(R.string.text_firma_sahibi_180a9); else -> tr(R.string.text_yonetici_1a342) }, color = MaterialTheme.colorScheme.primary)
                HorizontalDivider()
                Text(state.session?.server.orEmpty(), style = MaterialTheme.typography.bodyMedium)
            }
        }
        NotificationsView(state,model)
        Text(tr(R.string.text_uretim_kayitlari_firmanizin_renkflow_sistemine_k_8131f), color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(Modifier.fillMaxWidth().heightIn(min=56.dp),verticalAlignment=Alignment.CenterVertically) {
            Text(tr(R.string.text_uygulama_kilidi_52772),Modifier.weight(1f));Switch(checked=lock.enabled,onCheckedChange={enabled->if(enabled) activity?.let {FieldAppLock.unlock(it,true)} else FieldAppLock.disable(context)})
        }
        lock.message?.let {Text(it,color=MaterialTheme.colorScheme.error)}
        OutlinedButton(onClick = { logout = true }, enabled = !state.busy && state.pending == null, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) { Icon(Icons.AutoMirrored.Outlined.Logout, null); Spacer(Modifier.width(8.dp)); Text(tr(R.string.text_cikis_yap_ea5b6)) }
        Text(tr(R.string.text_surum_1_3975b, MobileContract.version), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (logout) AlertDialog(onDismissRequest = { logout = false }, title = { Text(tr(R.string.text_cikis_yapilsin_mi_4c115)) }, text = { Text(tr(R.string.text_bu_cihazdaki_oturumunuz_temizlenecek_112d5)) }, confirmButton = { TextButton(onClick = { model.logout(); logout = false }) { Text(tr(R.string.text_cikis_yap_ea5b6)) } }, dismissButton = { TextButton(onClick = { logout = false }) { Text(tr(R.string.text_vazgec_39a8d)) } })
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
            catch (e: Exception) { photoError = e.message ?: tr(R.string.text_fotograf_hazirlanamadi_2156d) }
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
            if (op.status in listOf("ready", "paused", "blocked")) Button(onClick = { onCommand(OperationInput(op.id, op.version, "start")) }, enabled = canWrite, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) { Icon(Icons.Outlined.PlayArrow, null); Text(tr(R.string.text_uretimi_baslat_9c3f4)) }
            if (op.status == "running") {
                OutlinedButton(onClick = { onCommand(OperationInput(op.id, op.version, "pause")) }, enabled = canWrite, modifier = Modifier.fillMaxWidth().heightIn(min=56.dp)) { Icon(Icons.Outlined.Pause, null); Text(tr(R.string.text_duraklat_19b6a)) }
                OutlinedTextField(count, { count = it }, Modifier.fillMaxWidth(), label = { Text(tr(R.string.text_tamamlanan_adet_0e48d)) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true)
                op.qualityChecks.forEach { check ->
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(check.name, fontWeight = FontWeight.SemiBold)
                        when (check.kind) {
                            "pass_fail" -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { FilterChip(passes[check.id] == true, { passes[check.id] = true }, label = { Text(tr(R.string.text_gecti_06942)) }); FilterChip(passes[check.id] == false, { passes[check.id] = false }, label = { Text(tr(R.string.text_kaldi_3d982)) }) }
                            "measurement" -> { Text("${check.minimum} – ${check.maximum} ${check.unit}", style = MaterialTheme.typography.labelMedium); OutlinedTextField(values[check.id].orEmpty(), { values[check.id] = it }, Modifier.fillMaxWidth(), label = { Text(tr(R.string.text_olcum_1_1cc7a, check.unit)) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true) }
                            "photo" -> Text(tr(R.string.text_yeni_fotograf_gerekli_2a5e5), color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
                OutlinedButton(onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, enabled = canWrite) { Icon(Icons.Outlined.AddPhotoAlternate, null); Spacer(Modifier.width(8.dp)); Text(if (photo != null) tr(R.string.text_fotograf_eklendi_4f69d) else tr(R.string.text_fotograf_ekle_81995)) }
                photoError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                OutlinedTextField(note, { if (it.length <= 2000) note = it }, Modifier.fillMaxWidth(), label = { Text(tr(R.string.text_uretim_notu_istege_bagli_591e5)) }, minLines = 2)
                Button(onClick = { confirm = true }, enabled = canWrite && validQuantity && qualityValid, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) { Text(tr(R.string.text_tamamlanan_miktari_kaydet_8737f)) }
            }
            ReworkView(op,state.snapshot?.operations.orEmpty(),canWrite,onCommand)
            if (op.status in listOf("waiting", "done", "cancelled")) Text(when (op.status) { "waiting" -> tr(R.string.text_onceki_adimlar_tamamlandiginda_bu_operasyon_hazi_d2bc2); "done" -> tr(R.string.text_bu_adim_tamamlandi_5fe67); else -> tr(R.string.text_bu_operasyon_iptal_edilmis_85982) }, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(12.dp))
        }
    }
    if (confirm) AlertDialog(onDismissRequest = { confirm = false }, title = { Text(tr(R.string.text_1_adet_kaydedilsin_mi_d43b8, count)) }, text = { Text(tr(R.string.text_kalite_sonuclari_sunucuda_kontrol_edilecek_basar_51fbc)) }, confirmButton = { TextButton(onClick = {
        val results = op.qualityChecks.map { QualityResult(it.id, if (it.kind == "pass_fail") passes[it.id] else if (it.kind == "photo") true else null, if (it.kind == "measurement") values[it.id]?.replace(',', '.')?.toDoubleOrNull() else null) }
        onCommand(OperationInput(op.id, op.version, "complete", count.toInt(), note.takeIf { it.isNotBlank() }, results, listOfNotNull(photo)))
        confirm = false
    }, enabled = canWrite && validQuantity && qualityValid) { Text(tr(R.string.text_kaydet_c1fe2)) } }, dismissButton = { TextButton(onClick = { confirm = false }) { Text(tr(R.string.text_vazgec_39a8d)) } })
}

@Composable private fun Notice(text: String, error: Boolean, dismiss: () -> Unit) {
    Surface(Modifier.padding(horizontal = 20.dp, vertical = 6.dp).fillMaxWidth(), shape = RoundedCornerShape(12.dp), color = if (error) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.secondaryContainer) {
        Row(Modifier.padding(start = 16.dp), verticalAlignment = Alignment.CenterVertically) { Text(text, Modifier.weight(1f).padding(vertical = 12.dp), style = MaterialTheme.typography.bodyMedium); IconButton(modifier=Modifier.size(56.dp),onClick = dismiss) { Icon(Icons.Outlined.Close, tr(R.string.text_bildirimi_kapat_b034a)) } }
    }
}
@Composable private fun EmptyState(title: String, subtitle: String, icon: ImageVector) {
    Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) { Icon(icon, null, Modifier.size(40.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant); Text(title, style = MaterialTheme.typography.titleMedium); Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
}
private fun quantity(value: Double): String = if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()
private fun displayDate(value: String): String = runCatching { DateTimeFormatter.ofPattern("d MMM, HH:mm", Locale.forLanguageTag("tr-TR")).withZone(ZoneId.systemDefault()).format(Instant.parse(value)) }.getOrElse { value.take(10) }
private fun labelKind(kind: String) = when (kind) { "job" -> tr(R.string.text_is_emri_10fe2); "item" -> tr(R.string.text_malzeme_97571); "lot" -> tr(R.string.text_lot_23ea1); "location" -> tr(R.string.text_konum_cc8b7); "product" -> tr(R.string.text_mamul_d803c); "cut" -> tr(R.string.text_kesim_paketi_52395); else -> tr(R.string.text_etiket_bc91f) }
