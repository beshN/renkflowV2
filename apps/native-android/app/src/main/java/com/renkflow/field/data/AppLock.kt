package com.renkflow.field.data
import com.renkflow.field.R
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
        if(BiometricManager.from(activity).canAuthenticate(authenticators)!=BiometricManager.BIOMETRIC_SUCCESS) {mutable.value=mutable.value.copy(message=tr(R.string.text_bu_cihazda_guvenli_kilit_hazir_degil_sistem_ayar_86aad));return}
        val prompt=BiometricPrompt(activity,ContextCompat.getMainExecutor(activity),object:BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result:BiometricPrompt.AuthenticationResult) {if(enable) activity.getSharedPreferences("field_lock",Context.MODE_PRIVATE).edit().putBoolean("enabled",true).apply();mutable.value=LockState(enabled=enable||mutable.value.enabled,unlocked=true)}
            override fun onAuthenticationError(code:Int,message:CharSequence) {mutable.value=mutable.value.copy(message=tr(R.string.text_kilit_acilamadi_yeniden_deneyebilirsiniz_b1567))}
        })
        val builder=BiometricPrompt.PromptInfo.Builder().setTitle(tr(R.string.text_renkflow_saha_671f9)).setSubtitle(tr(R.string.text_cihaz_kilidini_acin_36d7f)).setAllowedAuthenticators(authenticators)
        if(Build.VERSION.SDK_INT<30) builder.setNegativeButtonText(tr(R.string.text_vazgec_39a8d))
        prompt.authenticate(builder.build())
    }
}
