package com.renkflow.field.data
import android.Manifest
import android.os.Build
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import com.renkflow.field.R
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import java.util.UUID
@Serializable data class NotificationPreferences(val assignment:Boolean=true,val mention:Boolean=true,val delay:Boolean=true)
@Serializable data class FieldNotification(val id:String,val kind:String,val read:Boolean,val createdAt:String)
@Serializable data class NotificationList(val provider:String="disconnected",val notifications:List<FieldNotification> = emptyList())
class DeviceIdentity(context:Context) {
    private val prefs=context.getSharedPreferences("field_device",Context.MODE_PRIVATE)
    fun id():String=synchronized(lock) {prefs.getString("id",null)?.takeIf {runCatching {UUID.fromString(it)}.isSuccess} ?: UUID.randomUUID().toString().also {check(prefs.edit().putString("id",it).commit())}}
    companion object {private val lock=Any()}
}
/** Bridge for a configured FCM SDK's onNewToken callback. This build has no connected provider. */
class FcmRegistration(private val api:Api,context:Context) {
    private val identity=DeviceIdentity(context)
    val connected=false
    suspend fun register(auth:Session,token:String) {
        require(token.length in 32..2048)
        api.raw(auth.server,auth.token,"notifications/device",buildJsonObject {put("deviceId",identity.id());put("enabled",true);put("token",token)}.toString())
    }
}
fun showLocalNotification(context:Context):Boolean {
    if(Build.VERSION.SDK_INT>=33 && ContextCompat.checkSelfPermission(context,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) return false
    val manager=context.getSystemService(NotificationManager::class.java)
    if(!manager.areNotificationsEnabled()) return false
    manager.createNotificationChannel(NotificationChannel("field_local","Saha yerel test",NotificationManager.IMPORTANCE_DEFAULT))
    manager.notify(1001,NotificationCompat.Builder(context,"field_local").setSmallIcon(R.drawable.ic_brand_mark).setContentTitle("RenkFlow Saha").setContentText("Yerel bildirim testi").setAutoCancel(true).build())
    return true
}
