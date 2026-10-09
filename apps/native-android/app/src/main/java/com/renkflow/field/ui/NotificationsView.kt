package com.renkflow.field.ui
import com.renkflow.field.data.tr
import com.renkflow.field.R
import android.Manifest
import android.os.Build
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.renkflow.field.FieldState
import com.renkflow.field.FieldViewModel
import com.renkflow.field.data.showLocalNotification
@Composable fun NotificationsView(state:FieldState,model:FieldViewModel) {
    val context=LocalContext.current
    var result by remember {mutableStateOf<String?>(null)}
    fun local() {result=if(showLocalNotification(context)) tr(R.string.text_yerel_bildirim_gosterildi_abd2f) else tr(R.string.text_bildirim_izni_kapali_16fa9)}
    val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {if(it) local() else result=tr(R.string.text_bildirim_izni_verilmedi_27fc3)}
    Column(verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Text("Bildirimler",style=MaterialTheme.typography.titleLarge)
        Text(tr(R.string.text_fcm_baglanmadi_171b8),color=MaterialTheme.colorScheme.onSurfaceVariant)
        state.preferences?.let {prefs ->
            listOf(Triple("assignment",tr(R.string.text_is_atamasi_1f27c),prefs.assignment),Triple("mention","Bahsetme",prefs.mention),Triple("delay",tr(R.string.text_gecikme_99c55),prefs.delay)).forEach {(key,label,value)->
                Row(Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text(label,Modifier.weight(1f));Switch(value,{model.notificationPreference(key,it)},enabled=!state.stale&&!state.preferencesBusy&&!state.updateRequired)}
            }
        }
        OutlinedButton(onClick={if(Build.VERSION.SDK_INT>=33 && ContextCompat.checkSelfPermission(context,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) permission.launch(Manifest.permission.POST_NOTIFICATIONS) else local()},modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text(tr(R.string.text_yerel_bildirim_testi_0f5dc))}
        result?.let {Text(it)}
        state.notifications.take(10).forEach {item-> Text(when(item.kind) {"work_order:assigned"->tr(R.string.text_is_atamasi_1f27c);"mention"->"Bahsetme";else->tr(R.string.text_gecikme_uyarisi_fe3da)},style=MaterialTheme.typography.bodyMedium)}
    }
}
