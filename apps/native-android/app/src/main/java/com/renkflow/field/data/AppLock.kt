package com.renkflow.field.data
import android.content.Context
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

data class LockState(val enabled:Boolean=false,val unlocked:Boolean=true,val message:String?=null)
object FieldAppLock {
    private val mutable=MutableStateFlow(LockState())
    val state=mutable.asStateFlow()
    fun configure(context:Context) {val enabled=context.getSharedPreferences("field_lock",Context.MODE_PRIVATE).getBoolean("enabled",false);mutable.value=LockState(enabled,!enabled)}
    fun lock() {if(mutable.value.enabled) mutable.value=mutable.value.copy(unlocked=false,message=null)}
    fun disable(context:Context) {context.getSharedPreferences("field_lock",Context.MODE_PRIVATE).edit().putBoolean("enabled",false).apply();mutable.value=LockState()}
    fun unlock(activity:FragmentActivity,enable:Boolean=false) {
        val authenticators=if(Build.VERSION.SDK_INT>=30) BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL else BiometricManager.Authenticators.BIOMETRIC_STRONG
        if(BiometricManager.from(activity).canAuthenticate(authenticators)!=BiometricManager.BIOMETRIC_SUCCESS) {mutable.value=mutable.value.copy(message="Bu cihazda güvenli kilit hazır değil. Sistem ayarlarından biyometriyi etkinleştirin.");return}
        val prompt=BiometricPrompt(activity,ContextCompat.getMainExecutor(activity),object:BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result:BiometricPrompt.AuthenticationResult) {if(enable) activity.getSharedPreferences("field_lock",Context.MODE_PRIVATE).edit().putBoolean("enabled",true).apply();mutable.value=LockState(enabled=enable||mutable.value.enabled,unlocked=true)}
            override fun onAuthenticationError(code:Int,message:CharSequence) {mutable.value=mutable.value.copy(message="Kilit açılamadı. Yeniden deneyebilirsiniz.")}
        })
        val builder=BiometricPrompt.PromptInfo.Builder().setTitle("RenkFlow Saha").setSubtitle("Cihaz kilidini açın").setAllowedAuthenticators(authenticators)
        if(Build.VERSION.SDK_INT<30) builder.setNegativeButtonText("Vazgeç")
        prompt.authenticate(builder.build())
    }
}
