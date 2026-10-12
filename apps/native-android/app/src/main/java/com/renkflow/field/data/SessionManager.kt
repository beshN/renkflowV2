package com.renkflow.field.data
import android.content.Context
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import java.util.UUID
import java.util.Base64
/** Decoded identity is only used to bind requests to the saved session; the server verifies signatures. */
fun tokenSessionId(token:String):String? = runCatching {fieldJson.parseToJsonElement(String(Base64.getUrlDecoder().decode(token.split('.')[1]))).jsonObject["sid"]?.jsonPrimitive?.content}.getOrNull()
interface SessionStorage {fun read():Session?;fun write(value:Session)}
class SessionManager(private val storage:SessionStorage,private val api:Api=Api()) {
    suspend fun token(server:String,requested:String):String = mutex.withLock {
        val saved=storage.read() ?: throw ApiException(401,"Oturum açın.")
        if(saved.server!=server || tokenSessionId(requested)!=saved.sessionId) throw ApiException(401,"Cihaz oturumu değişti.")
        if(saved.expiresAt>System.currentTimeMillis()+60_000) return@withLock saved.token
        val refresh=saved.refreshToken ?: throw ApiException(401,"Yeniden giriş yapın.")
        val device=saved.deviceId ?: throw ApiException(401,"Yeniden giriş yapın.")
        val request=saved.refreshRequestId ?: UUID.randomUUID().toString()
        val pending=saved.copy(refreshRequestId=request);storage.write(pending)
        val result=fieldJson.decodeFromJsonElement<LoginResult>(api.raw(server,null,"auth/refresh",buildJsonObject {put("refreshToken",refresh);put("requestId",request);put("deviceId",device)}.toString()))
        // A logout/account switch while the HTTP call was in flight must never resurrect credentials.
        val latest=storage.read()
        if(latest?.sessionId!=saved.sessionId || latest?.refreshToken!=saved.refreshToken) throw ApiException(401,"Cihaz oturumu değişti.")
        val next=saved.copy(token=result.accessToken,expiresAt=System.currentTimeMillis()+result.expiresIn*1000,user=result.user,refreshToken=result.refreshToken,sessionId=result.sessionId,deviceId=result.deviceId,refreshRequestId=null)
        storage.write(next);next.token
    }
    companion object {
        private val mutex=Mutex()
        fun api(context:Context):Api {val vault=Vault(context);val manager=SessionManager(object:SessionStorage {override fun read()=vault.session();override fun write(value:Session)=vault.saveSession(value)});return Api(tokenResolver={server,token->manager.token(server,token)})}
    }
}
