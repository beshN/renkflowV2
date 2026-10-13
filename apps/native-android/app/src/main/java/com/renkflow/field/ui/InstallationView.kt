package com.renkflow.field.ui
import com.renkflow.field.data.sessionScope
import com.renkflow.field.data.tr
import com.renkflow.field.R
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.PickVisualMediaRequest
import androidx.compose.ui.platform.LocalContext
import com.renkflow.field.data.photoBase64
import kotlinx.coroutines.*
import com.renkflow.field.FieldState
import com.renkflow.field.FieldViewModel
import java.time.LocalDate
@OptIn(ExperimentalMaterial3Api::class)
@Composable fun InstallationView(state:FieldState,model:FieldViewModel,close:()->Unit) {
    var today by remember {mutableStateOf(true)}
    var selected by remember {mutableStateOf<String?>(null)}
    var issue by remember {mutableStateOf("")}
    var kind by remember {mutableStateOf("missing")}
    var preparing by remember {mutableStateOf(false)}
    var photoMessage by remember {mutableStateOf<String?>(null)}
    val context=LocalContext.current;val scope=rememberCoroutineScope()
    val picker=rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) {uri ->
        val id=selected
        if(uri!=null && id!=null) scope.launch {val photoScope=state.session?.let(::sessionScope) ?: return@launch;preparing=true;try {val bytes=withContext(Dispatchers.IO) {photoBase64(context,uri)};model.uploadInstallationPhoto(id,bytes,photoScope) {photoMessage=tr(R.string.text_fotograf_cihazda_kaydedildi_51f1d)}} catch(_:Exception) {photoMessage=tr(R.string.text_fotograf_hazirlanamadi_2156d)} finally {preparing=false}}
    }
    val writable=state.references?.capabilities?.installationEdit==true && !state.accessBlocked && !state.updateRequired
    ModalBottomSheet(onDismissRequest=close) {
        LazyColumn(contentPadding=PaddingValues(20.dp),verticalArrangement=Arrangement.spacedBy(16.dp)) {
            item {Text(tr(R.string.text_montaj_1e486),style=MaterialTheme.typography.headlineMedium)}
            if(selected==null) {
                item {Row {Text(tr(R.string.text_bugunku_ekip_isleri_29058),Modifier.weight(1f));Switch(today,{today=it})}}
                val list=state.installations.filter {!today || it.date==LocalDate.now().toString()}
                if(list.isEmpty()) item {Text(tr(R.string.text_bu_gun_icin_atanan_montaj_yok_c987e))}
                items(list,key={it.id}) {job ->
                    OutlinedButton(onClick={selected=job.id;model.openInstallation(job.id)},modifier=Modifier.fillMaxWidth().heightIn(min=72.dp)) {
                        Column(Modifier.fillMaxWidth()) {Text(job.number);Text("${job.date.orEmpty()} ${job.startTime.orEmpty()} · ${job.productName.orEmpty()}");Text("${job.checklistCompleted}/${job.checklistTotal} kontrol")}
                    }
                }
            } else {
                item {OutlinedButton(onClick={selected=null},modifier=Modifier.heightIn(min=56.dp)) {Text(tr(R.string.text_listeye_don_bb341))}}
                val detail=state.installationDetail?.takeIf {it.id==selected}
                if(detail==null) item {Text(tr(R.string.text_kayit_yukleniyor_cevrimdisiysa_daha_once_actigin_3e69a))}
                else {
                    item {Text(statusLabelForInstallation(detail.status),style=MaterialTheme.typography.titleLarge)}
                    if(writable && detail.status in listOf("planned","in_progress")) item {
                        Button(onClick={model.installationCommand(if(detail.status=="planned") "start" else "complete")},modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text(if(detail.status=="planned") tr(R.string.text_montaji_baslat_769f7) else tr(R.string.text_montaji_tamamla_9f08c))}
                    }
                    items(detail.checklist,key={it.id}) {item ->
                        Row(Modifier.fillMaxWidth().heightIn(min=56.dp)) {Checkbox(item.completed,{model.installationCommand("checklist",item)},enabled=writable && detail.status !in listOf("done","cancelled"));Text(item.title,Modifier.weight(1f))}
                    }
                    item {Text(tr(R.string.text_1_saha_fotografi_f555f, detail.photos.size));photoMessage?.let {Text(it)}}
                    if(writable && detail.status !in listOf("done","cancelled")) item {OutlinedButton(onClick={picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))},enabled=!preparing,modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text(tr(R.string.text_saha_fotografi_ekle_51f0d))}}
                    items(detail.issues) {entry ->Text("${if(entry.kind=="damage") "Hasar" else "Eksik"} · ${entry.text}")}
                    if(writable && detail.status !in listOf("done","cancelled")) item {
                        Column(verticalArrangement=Arrangement.spacedBy(12.dp)) {
                            Row {FilterChip(kind=="missing",{kind="missing"},label={Text("Eksik")});Spacer(Modifier.width(8.dp));FilterChip(kind=="damage",{kind="damage"},label={Text(tr(R.string.text_hasar_1b191))})}
                            OutlinedTextField(issue,{if(it.length<=1000) issue=it},label={Text(tr(R.string.text_saha_notu_10e6a))},minLines=2,modifier=Modifier.fillMaxWidth())
                            Button(onClick={model.installationCommand("issue",kind=kind,text=issue);issue=""},enabled=issue.trim().length>=3,modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text(tr(R.string.text_notu_kaydet_04416))}
                        }
                    }
                }
            }
        }
    }
}
private fun statusLabelForInstallation(status:String)=when(status) {"planned"->tr(R.string.text_planlandi_03e58);"in_progress"->"Sahada";"done"->tr(R.string.text_tamamlandi_7c6f3);else->tr(R.string.text_iptal_72278)}
