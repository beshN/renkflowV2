package com.renkflow.field.ui
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
    fun local() {result=if(showLocalNotification(context)) "Yerel bildirim gösterildi." else "Bildirim izni kapalı."}
    val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {if(it) local() else result="Bildirim izni verilmedi."}
    Column(verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Text("Bildirimler",style=MaterialTheme.typography.titleLarge)
        Text("FCM · Bağlanmadı",color=MaterialTheme.colorScheme.onSurfaceVariant)
        state.preferences?.let {prefs ->
            listOf(Triple("assignment","İş ataması",prefs.assignment),Triple("mention","Bahsetme",prefs.mention),Triple("delay","Gecikme",prefs.delay)).forEach {(key,label,value)->
                Row(Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text(label,Modifier.weight(1f));Switch(value,{model.notificationPreference(key,it)},enabled=!state.stale&&!state.preferencesBusy&&!state.updateRequired)}
            }
        }
        OutlinedButton(onClick={if(Build.VERSION.SDK_INT>=33 && ContextCompat.checkSelfPermission(context,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) permission.launch(Manifest.permission.POST_NOTIFICATIONS) else local()},modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)) {Text("Yerel bildirim testi")}
        result?.let {Text(it)}
        state.notifications.take(10).forEach {item-> Text(when(item.kind) {"work_order:assigned"->"İş ataması";"mention"->"Bahsetme";else->"Gecikme uyarısı"},style=MaterialTheme.typography.bodyMedium)}
    }
}
