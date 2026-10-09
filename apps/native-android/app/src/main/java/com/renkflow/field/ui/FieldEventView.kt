package com.renkflow.field.ui
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import com.renkflow.field.data.*
@Composable fun FieldEventView(references:FieldReferences?,writable:Boolean,save:(String,String,Int,String)->Unit) {
    var show by remember {mutableStateOf(false)}
    var kind by remember {mutableStateOf("scrap")}
    var code by remember {mutableStateOf("")}
    var count by remember {mutableStateOf("1")}
    var note by remember {mutableStateOf("")}
    if(references?.capabilities?.reasonCodes!=true) return
    OutlinedButton(onClick={show=true},enabled=writable,modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text("Fire / gecikme bildir")}
    if(show) AlertDialog(onDismissRequest={show=false},title={Text("Saha bildirimi")},text={
        Column(verticalArrangement=Arrangement.spacedBy(10.dp)) {
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                FilterChip(kind=="scrap",{kind="scrap";code=""},label={Text("Fire")})
                FilterChip(kind=="delay",{kind="delay";code=""},label={Text("Gecikme")})
            }
            references.reasons.filter {it.kind==kind}.forEach {reason ->
                OutlinedButton(onClick={code=reason.code},modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text((if(code==reason.code) "✓ " else "")+reason.label)}
            }
            if(kind=="scrap") OutlinedTextField(count,{count=it},label={Text("Adet")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number))
            OutlinedTextField(note,{if(it.length<=500) note=it},label={Text("Açıklama (isteğe bağlı)")})
        }
    },confirmButton={Button(onClick={save(kind,code,count.toIntOrNull()?:1,note);show=false},enabled=writable&&code.isNotEmpty()&&(kind!="scrap" || (count.toIntOrNull()?:0) in 1..100000),modifier=Modifier.heightIn(min=56.dp)) {Text("Kaydet")}},dismissButton={TextButton(onClick={show=false}) {Text("Vazgeç")}})
}
