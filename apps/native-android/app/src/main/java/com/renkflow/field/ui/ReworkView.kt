package com.renkflow.field.ui
import com.renkflow.field.data.tr
import com.renkflow.field.data.tr
import com.renkflow.field.R
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.renkflow.field.data.*
@Composable fun ReworkView(op:Operation,operations:List<Operation>,writable:Boolean,submit:(OperationInput)->Unit) {
    var show by remember {mutableStateOf(false)}
    var target by remember {mutableStateOf(op.id)}
    var code by remember {mutableStateOf("measurement")}
    var count by remember {mutableStateOf("1")}
    var reason by remember {mutableStateOf("")}
    if(op.status !in listOf("paused","blocked","done")) return
    OutlinedButton(onClick={show=true},enabled=writable,modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text(tr(R.string.text_yeniden_isleme_rework_4f689))}
    if(show) AlertDialog(onDismissRequest={show=false},title={Text(tr(R.string.text_yeniden_isleme_4ca75))},text={
        Column(Modifier.heightIn(max=440.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(10.dp)) {
            Text(tr(R.string.text_onceki_asamalar_yeniden_acilir_sunucu_miktari_ve_e05c5))
            operations.filter {it.workOrderId==op.workOrderId && it.position<=op.position}.forEach {item ->
                OutlinedButton(onClick={target=item.id},modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text((if(target==item.id) "✓ " else "")+item.name)}
            }
            listOf("measurement" to tr(R.string.text_olcum_be440),"material" to tr(R.string.text_malzeme_97571),"assembly" to tr(R.string.text_montaj_1e486),"quality" to "Kalite","other" to tr(R.string.text_diger_6cceb)).forEach {(id,label)->
                FilterChip(code==id,{code=id},label={Text(label)},modifier=Modifier.heightIn(min=56.dp))
            }
            OutlinedTextField(count,{count=it},label={Text(tr(R.string.text_etkilenen_adet_29647))},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number))
            OutlinedTextField(reason,{if(it.length<=1000) reason=it},label={Text(tr(R.string.text_gerekce_d11ad))},minLines=2)
        }
    },confirmButton={Button(onClick={submit(OperationInput(op.id,op.version,"rework",quantity=count.toInt(),reason=reason.trim(),reasonCode=code,targetOperationId=target));show=false},enabled=writable&&reason.trim().length>=5&&(count.toIntOrNull()?:0)>0&&(count.toIntOrNull()?:0)<=op.plannedQty,modifier=Modifier.heightIn(min=56.dp)) {Text(tr(R.string.text_rework_kaydet_b23df))}},dismissButton={TextButton(onClick={show=false}) {Text(tr(R.string.text_vazgec_39a8d))}})
}
