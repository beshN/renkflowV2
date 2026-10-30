// Recovery copy from session source output and recorded patches; local disk was inaccessible.
package com.renkflow.field.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.security.KeyStore
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@Serializable data class WorkspaceIdentity(val id:String,val email:String?=null,val name:String?=null,val role:String?=null,val tenantId:String?=null)
@Serializable private data class WorkspaceHttpSession(val origin:String,val cookies:List<String>)

/** Cookies are independent from the field outbox and encrypted with a device-bound key. */
private class WorkspaceVault(context:Context) {
    private val prefs=context.getSharedPreferences("native_workspace_v1",Context.MODE_PRIVATE)
    private val alias="renkflow.workspace.http.v1"
    private fun key():SecretKey {
        val store=KeyStore.getInstance("AndroidKeyStore").apply {load(null)}
        return store.getKey(alias,null) as? SecretKey ?: KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore").apply {init(KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())}.generateKey()
    }
    fun read():String?=runCatching {
        val bytes=Base64.decode(prefs.getString("session",null) ?: return@runCatching null,Base64.NO_WRAP)
        val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply {init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,bytes.copyOfRange(0,12)))}
        String(cipher.doFinal(bytes.copyOfRange(12,bytes.size)),Charsets.UTF_8)
    }.getOrNull()
    fun write(text:String) {
        val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply {init(Cipher.ENCRYPT_MODE,key())}
        check(prefs.edit().putString("session",Base64.encodeToString(cipher.iv+cipher.doFinal(text.toByteArray()),Base64.NO_WRAP)).commit())
    }
    fun clear() {check(prefs.edit().clear().commit())}
}

internal class NativeCookieJar(private val host:String,initial:List<Cookie> = emptyList(),private val persist:(List<Cookie>)->Unit={}) : CookieJar {
    private val values=initial.toMutableList()
    @Synchronized override fun saveFromResponse(url:HttpUrl,cookies:List<Cookie>) {
        if(url.host!=host || !url.isHttps) return
        cookies.filter {it.domain==host}.forEach {cookie ->
            values.removeAll {it.name==cookie.name && it.path==cookie.path && it.domain==cookie.domain}
            if(cookie.expiresAt>System.currentTimeMillis()) values.add(cookie)
        }
        persist(values.toList())
    }
    @Synchronized override fun loadForRequest(url:HttpUrl):List<Cookie> = if(url.host==host && url.isHttps) values.filter {it.expiresAt>System.currentTimeMillis() && it.matches(url)} else emptyList()
}

class NativeWorkspaceApi(context:Context?=null,private val transport:OkHttpClient=OkHttpClient.Builder().connectTimeout(15,TimeUnit.SECONDS).readTimeout(30,TimeUnit.SECONDS).callTimeout(60,TimeUnit.SECONDS).build(),persistence:Boolean=true) {
    private val vault=if(persistence) WorkspaceVault(requireNotNull(context).applicationContext) else null
    private val generation=AtomicInteger(0)
    @Volatile private var origin="https://renkflow.com"
    @Volatile private var client:OkHttpClient=transport
    init {
        val saved=vault?.read()?.let {runCatching {fieldJson.decodeFromString<WorkspaceHttpSession>(it)}.getOrNull()}
        origin=saved?.origin?.let {runCatching {normalizeServer(it)}.getOrNull()} ?: origin
        reset(saved?.cookies.orEmpty())
    }
    @Synchronized private fun reset(saved:List<String> = emptyList()) {
        val epoch=generation.incrementAndGet();client.dispatcher.cancelAll()
        val base=origin.toHttpUrl()
        val jar=NativeCookieJar(base.host,saved.mapNotNull {Cookie.parse(base,it)}) {cookies ->
            if(generation.get()==epoch) vault?.write(fieldJson.encodeToString(WorkspaceHttpSession(origin,cookies.map(Cookie::toString))))
        }
        client=transport.newBuilder().followRedirects(false).followSslRedirects(false).cookieJar(jar).build()
    }
    fun server():String=origin
    fun hasSession():Boolean=client.cookieJar.loadForRequest((origin+"/api/auth/session").toHttpUrl()).any {it.name.contains("session-token")}
    @Synchronized fun configure(server:String) {
        val next=normalizeServer(server)
        if(origin!=next) {origin=next;vault?.clear();reset()}
    }
    @Synchronized fun clear() {vault?.clear();reset()}
    private suspend fun send(path:String,method:String="GET",body:RequestBody?=null):JsonElement=withContext(Dispatchers.IO) {
        require(path.startsWith("/api/") && !path.contains('\\')) {"Geçersiz API adresi."}
        val epoch=generation.get();val base=origin
        val url=(base+path).toHttpUrl()
        require(url.scheme=="https" && url.host==base.toHttpUrl().host && url.port==base.toHttpUrl().port)
        val request=Request.Builder().url(url).header("Accept","application/json").header("Origin",base).header("Referer","$base/").header("X-RenkFlow-Client","RenkFlow-Native/Android")
        if(path.startsWith("/api/auth/callback/") || path=="/api/auth/signout") request.header("X-Auth-Return-Redirect","1")
        request.method(method,if(method in listOf("POST","PATCH","PUT")) body ?: "{}".toRequestBody("application/json".toMediaType()) else body)
        client.newCall(request.build()).execute().use {response ->
            if(generation.get()!=epoch) throw kotlinx.coroutines.CancellationException("Account changed")
            val text=response.body?.string().orEmpty()
            val result=runCatching {fieldJson.parseToJsonElement(text)}.getOrDefault(JsonNull)
            if(!response.isSuccessful && !(path.startsWith("/api/auth/callback/") && result.text("url")!=null)) throw ApiException(response.code,result.text("error") ?: result.text("message") ?: if(response.code==401) "Oturumunuz sona erdi. Yeniden giriş yapın." else "İşlem tamamlanamadı (${response.code}).")
            if(response.code==204) return@use buildJsonObject {}
            if(path=="/api/auth/session" && text.trim()=="null") return@use JsonNull
            if(result is JsonNull) throw ApiException(502,"Sunucudan geçerli bir JSON yanıtı alınamadı.")
            result
        }
    }
    suspend fun request(path:String,method:String="GET",body:JsonElement?=null):JsonElement=send(path,method,body?.toString()?.toRequestBody("application/json".toMediaType()))
    private suspend fun form(path:String,fields:Map<String,String>):JsonElement=send(path,"POST",FormBody.Builder().apply {fields.forEach {(key,value)->add(key,value)}}.build())
    suspend fun signIn(server:String,email:String,password:String,otp:String?=null):WorkspaceIdentity {
        configure(server);if(otp==null) clear()
        val csrf=request("/api/auth/csrf").text("csrfToken") ?: throw ApiException(502,"Güvenli giriş başlatılamadı.")
        val fields=mutableMapOf("email" to email.trim().lowercase(),"password" to password,"csrfToken" to csrf,"callbackUrl" to "$origin/dashboard","json" to "true")
        if(!otp.isNullOrBlank()) fields["otp"]=otp
        val response=form("/api/auth/callback/credentials",fields)
        val query=response.text("url")?.let {java.net.URI(it).rawQuery}.orEmpty().split('&').filter {it.contains('=')}.associate {part -> val pair=part.split('=',limit=2); java.net.URLDecoder.decode(pair[0],"UTF-8") to java.net.URLDecoder.decode(pair[1],"UTF-8")}
        if(query["error"]!=null) {
            val code=query["code"] ?: query["error"]
            if(code=="otp_required") throw ApiException(428,"Doğrulama kodunuzu girin.")
            throw ApiException(401,when(code) {"otp_invalid"->"Doğrulama kodu geçersiz.";"rate_limited"->"Çok fazla deneme yapıldı. Biraz bekleyin.";else->"E-posta veya şifre doğrulanamadı."})
        }
        return identity()
    }
    suspend fun identity():WorkspaceIdentity {
        val result=request("/api/auth/session")["user"]
        if(result.text("id")==null) throw ApiException(401,"Oturum açmanız gerekiyor.")
        return fieldJson.decodeFromJsonElement(result)
    }
    suspend fun signOut() {
        runCatching {val token=request("/api/auth/csrf").text("csrfToken");if(token!=null) form("/api/auth/signout",mapOf("csrfToken" to token,"callbackUrl" to "$origin/auth/login","json" to "true"))}
        clear()
    }
}

operator fun JsonElement.get(key:String):JsonElement=(this as? JsonObject)?.get(key) ?: JsonNull
fun JsonElement.text(key:String):String?=(this[key] as? JsonPrimitive)?.contentOrNull
fun JsonElement.number(key:String):Double?=(this[key] as? JsonPrimitive)?.doubleOrNull
fun JsonElement.rows(vararg keys:String):List<JsonElement> {
    if(this is JsonArray) return this
    keys.forEach {key -> (this[key] as? JsonArray)?.let {return it}}
    if(this["data"] is JsonArray) return this["data"] as JsonArray
    if(this["data"] is JsonObject) return this["data"].rows(*keys)
    return emptyList()
}
