package com.renkflow.field.ui
import com.renkflow.field.data.tr
import com.renkflow.field.R
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.PrecisionManufacturing
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
@Composable fun FamilyThumbnail(family:String?) {
    val ink=MaterialTheme.colorScheme.onSurfaceVariant
    val accent=MaterialTheme.colorScheme.primary
    if(family!="pergola") {Icon(Icons.Outlined.PrecisionManufacturing,tr(R.string.text_uretim_isi_b3d75),Modifier.size(40.dp),tint=ink);return}
    Canvas(Modifier.size(72.dp,48.dp).semantics {contentDescription=tr(R.string.text_pergola_urun_ailesi_cizimi_8dff4)}) {
        fun line(x1:Float,y1:Float,x2:Float,y2:Float)=drawLine(ink,Offset(size.width*x1,size.height*y1),Offset(size.width*x2,size.height*y2),strokeWidth=2.dp.toPx())
        line(.12f,.36f,.8f,.36f);line(.8f,.36f,.92f,.16f);line(.92f,.16f,.24f,.16f);line(.24f,.16f,.12f,.36f)
        line(.12f,.36f,.12f,.9f);line(.8f,.36f,.8f,.9f);line(.92f,.16f,.92f,.7f)
        for(i in 1..5) {val x=.12f+i*.11f;drawLine(accent,Offset(size.width*x,size.height*.36f),Offset(size.width*(x+.12f),size.height*.16f),strokeWidth=1.dp.toPx())}
    }
}
