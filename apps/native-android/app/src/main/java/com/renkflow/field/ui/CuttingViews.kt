package com.renkflow.field.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.renkflow.field.data.*

/** Geometry uses real millimetres; kerf and leftover remain separate from usable pieces. */
fun barSegments(bar:CutBar):List<Double> = bar.pieces.map {it.lengthMm} + listOf(bar.lossMm,bar.remainingMm)

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun CuttingPlans(plans:List<CutPlan>,jobs:List<WorkOrder>,openJob:(String)->Unit) {
    var selected by remember {mutableStateOf<CutPlan?>(null)}
    plans.forEach {plan ->
        OutlinedButton(onClick={selected=plan},modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text("Kesim · ${plan.bars.size} çubuk · ${statusLabel(plan.status)}")}
    }
    selected?.let {plan ->
        ModalBottomSheet(onDismissRequest={selected=null}) {
            androidx.compose.foundation.lazy.LazyColumn(contentPadding=PaddingValues(20.dp),verticalArrangement=Arrangement.spacedBy(20.dp)) {
                item {Text("Kesim şeması",style=MaterialTheme.typography.headlineSmall);Text("Parçaya dokunun · sağa kaydırarak inceleyin")}
                items(plan.bars.size) {index ->
                    val bar=plan.bars[index]
                    var zoom by remember(bar.id) {mutableFloatStateOf(1f)}
                    var piece by remember(bar.id) {mutableStateOf<CutPiece?>(null)}
                    Column(verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        Text("${index+1} · ${bar.color} · ${bar.lengthMm.toInt()} mm",style=MaterialTheme.typography.titleMedium)
                        BoxWithConstraints(Modifier.fillMaxWidth()) {
                            val width=maxWidth*zoom
                            Row(Modifier.horizontalScroll(rememberScrollState())) {
                                Row(Modifier.width(width).height(64.dp).background(MaterialTheme.colorScheme.outlineVariant,RoundedCornerShape(6.dp))) {
                                    bar.pieces.forEachIndexed {i,p ->
                                        val segment=(p.lengthMm/bar.lengthMm).toFloat().coerceAtLeast(0.001f)
                                        val color=if(i%2==0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.tertiary
                                        Surface(onClick={piece=p},modifier=Modifier.width(width*segment).fillMaxHeight().padding(end=1.dp).semantics {contentDescription="${p.lengthMm.toInt()} milimetre parça"},color=color) {
                                            Box(Modifier.padding(6.dp)) {Text("${p.lengthMm.toInt()}",color=MaterialTheme.colorScheme.onPrimary,style=MaterialTheme.typography.labelMedium,maxLines=1)}
                                        }
                                    }
                                }
                            }
                        }
                        Slider(value=zoom,onValueChange={zoom=it},valueRange=1f..4f,modifier=Modifier.semantics {contentDescription="Kesim şeması yakınlaştırma"})
                        Text("Fire ${bar.lossMm.toInt()} mm · kalan ${bar.remainingMm.toInt()} mm${if(bar.reusable) " · yeniden kullanılabilir" else ""}",style=MaterialTheme.typography.labelMedium)
                        piece?.let {p ->
                            val job=jobs.firstOrNull {it.id==p.workOrderId}
                            Text("${p.lengthMm.toInt()} mm · ${job?.title ?: "İş emri"}")
                            if(job!=null) OutlinedButton(onClick={selected=null;openJob(job.id)},modifier=Modifier.heightIn(min=56.dp)) {Text("İş emrini aç")}
                        }
                    }
                }
            }
        }
    }
}
