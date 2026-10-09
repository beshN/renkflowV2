package com.renkflow.field.data
import android.content.Context
import androidx.annotation.StringRes
/** Uses only the application context; never retains an activity. */
object FieldStrings {
    private var context:Context?=null
    fun configure(value:Context) {context=value.applicationContext}
    fun text(@StringRes key:Int,vararg args:Any):String=context?.getString(key,*args) ?: key.toString()
}
fun tr(@StringRes key:Int,vararg args:Any):String=FieldStrings.text(key,*args)
