package com.renkflow.field.ui
import com.renkflow.field.data.tr
import com.renkflow.field.R
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.PickVisualMediaRequest
import kotlinx.coroutines.*
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import com.renkflow.field.data.*
@Composable fun FieldEventView(references:FieldReferences?,writable:Boolean,save:(String,String,Int,String,String?)->Unit,upload:(String,(String)->Unit)->Unit) {
    var show by remember {mutableStateOf(false)}
    var kind by remember {mutableStateOf("scrap")}
    var code by remember {mutableStateOf("")}
    var count by remember {mutableStateOf("1")}
    var note by remember {mutableStateOf("")}
    var photo by remember {mutableStateOf<String?>(null)}
    var preparing by remember {mutableStateOf(false)}
    var photoError by remember {mutableStateOf(false)}
    val context=LocalContext.current;val scope=rememberCoroutineScope()
    val picker=rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) {uri ->
        if(uri!=null) scope.launch {
            preparing=true;photoError=false
            try {val bytes=withContext(Dispatchers.IO) {photoBase64(context,uri)};upload(bytes) {photo=it}}
            catch(_:Exception) {photoError=true} finally {preparing=false}
        }
    }
    if(references?.capabilities?.reasonCodes!=true) return
    OutlinedButton(onClick={show=true},enabled=writable,modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text(tr(R.string.text_fire_gecikme_bildir_38c51))}
    if(show) AlertDialog(onDismissRequest={show=false},title={Text(tr(R.string.text_saha_bildirimi_6c0dc))},text={
        Column(Modifier.heightIn(max=440.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(10.dp)) {
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                FilterChip(kind=="scrap",{kind="scrap";code=""},label={Text(tr(R.string.text_fire_c141f))})
                FilterChip(kind=="delay",{kind="delay";code=""},label={Text(tr(R.string.text_gecikme_99c55))})
            }
            references.reasons.filter {it.kind==kind}.forEach {reason ->
                OutlinedButton(onClick={code=reason.code},modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text((if(code==reason.code) "✓ " else "")+reason.label)}
            }
            if(kind=="scrap") OutlinedTextField(count,{count=it},label={Text(tr(R.string.text_adet_fb2a0))},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number))
            if(kind=="scrap") OutlinedButton(onClick={picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))},enabled=writable&&!preparing,modifier=Modifier.heightIn(min=56.dp)) {Text(if(photo!=null) tr(R.string.text_fotograf_eklendi_d9a66) else tr(R.string.text_fotograf_ekle_istege_bagli_85989))}
            if(photoError) Text(tr(R.string.text_fotograf_hazirlanamadi_2156d),color=MaterialTheme.colorScheme.error)
            OutlinedTextField(note,{if(it.length<=500) note=it},label={Text(tr(R.string.text_aciklama_istege_bagli_e4db2))})
        }
    },confirmButton={Button(onClick={save(kind,code,count.toIntOrNull()?:1,note,photo);show=false},enabled=writable&&!preparing&&code.isNotEmpty()&&(kind!="scrap" || (count.toIntOrNull()?:0) in 1..100000),modifier=Modifier.heightIn(min=56.dp)) {Text(tr(R.string.text_kaydet_c1fe2))}},dismissButton={TextButton(onClick={show=false}) {Text(tr(R.string.text_vazgec_39a8d))}})
}
