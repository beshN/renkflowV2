package com.renkflow.field.data

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.OkHttpClient
import okhttp3.Request
import okio.Buffer
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.IOException
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.UUID
import javax.net.ssl.*

@RunWith(AndroidJUnit4::class)
class LiveOutboxTest {
    @Test fun persistedOfflineProductionPhotosAndLostAckReconnectExactlyOnce()=runBlocking {
        val trust=object:X509TrustManager {
            override fun getAcceptedIssuers()=emptyArray<X509Certificate>()
            override fun checkClientTrusted(c:Array<X509Certificate>,a:String)=Unit
            override fun checkServerTrusted(c:Array<X509Certificate>,a:String)=Unit
        }
        val tls=SSLContext.getInstance("TLS").apply {init(null,arrayOf(trust),SecureRandom())}
        val client=OkHttpClient.Builder().sslSocketFactory(tls.socketFactory,trust).hostnameVerifier {host,_->host=="10.0.2.2"}.followRedirects(false).build()
        val origin="https://10.0.2.2:3043"
        val fixture=client.newCall(Request.Builder().url("$origin/fixture").build()).execute().use {assertEquals(200,it.code);fieldJson.parseToJsonElement(it.body!!.string()).jsonObject}
        fun value(key:String)=fixture.getValue(key).jsonPrimitive.content
        val api=Api(client)
        val login=api.login(origin,value("email"),value("password"))
        val auth=Session(origin,login.accessToken,Long.MAX_VALUE,login.user)
        val initial=api.snapshot(auth)
        val op=initial.operations.first {it.id==value("operationId")}
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val name="live-outbox-${UUID.randomUUID()}.db"
        fun open()=OfflineStore(Room.databaseBuilder(context,OfflineDatabase::class.java,name).build())
        var store=open()
        try {
            val scope=sessionScope(auth)
            val startID=UUID.randomUUID().toString()
            val photoID=UUID.randomUUID().toString()
            store.enqueueWithCache(scope,SyncRequest(startID,"operation",fieldJson.encodeToJsonElement(OperationInput(op.id,op.version,"start")).jsonObject),mapOf("snapshot" to fieldJson.encodeToString(initial)))
            store.dao.enqueue(OutboxRecord(scope=scope,commandId=photoID,kind="photo",payload=fieldJson.encodeToString(LocalPhoto(value("productionJobId"),value("jpegLarge")))))
            store.enqueue(scope,SyncRequest(UUID.randomUUID().toString(),"operation",fieldJson.encodeToJsonElement(OperationInput(op.id,op.version+1,"complete",1,qualityResults=listOf(QualityResult("visual",passed=true)),photos=listOf("local://$photoID"))).jsonObject))
            assertEquals(3,store.dao.pending(scope).size)
            // Production reaches the real server, but the response is lost before local delivery.
            var lost=false
            val real=APIOutboxSender(store,api,auth)
            OutboxSync(store,object:OutboxSender {override suspend fun send(record:OutboxRecord):String? {val url=real.send(record);if(!lost) {lost=true;throw IOException("lost acknowledgement")};return url}}).drain(scope)
            store.db.close();store=open();store.prepare();assertNotNull(store.dao.cache(scope,"snapshot"))
            store.dao.pending(scope).forEach {store.dao.update(it.copy(nextAttemptAt=0))}
            var interrupted=false
            val faulty=client.newBuilder().addInterceptor {chain->
                val request=chain.request()
                if(request.url.encodedPath.endsWith("/uploads") && !interrupted) {
                    val buffer=Buffer();request.body?.writeTo(buffer)
                    val body=fieldJson.parseToJsonElement(buffer.readUtf8()).jsonObject
                    if(body["action"]?.jsonPrimitive?.content=="chunk" && (body["offset"]?.jsonPrimitive?.intOrNull?:0)>=262144) {interrupted=true;throw IOException("connection interrupted")}
                }
                chain.proceed(request)
            }.build()
            OutboxSync(store,APIOutboxSender(store,Api(faulty),auth)).drain(scope)
            assertTrue(interrupted);assertEquals("photo",store.dao.pending(scope).first().kind)
            val status=fieldJson.decodeFromJsonElement<UploadStatus>(api.raw(origin,auth.token,"uploads/$photoID"));assertEquals(262144,status.receivedBytes)
            store.db.close();store=open();store.prepare();store.dao.pending(scope).forEach {store.dao.update(it.copy(nextAttemptAt=0))}
            val sync=OutboxSync(store,APIOutboxSender(store,api,auth));sync.drain(scope);sync.drain(scope)
            assertTrue(store.dao.pending(scope).isEmpty());assertNotNull(store.dao.find(scope,photoID)?.resultURL)
            assertEquals(op.completedQty+1,api.snapshot(auth).operations.first {it.id==op.id}.completedQty,0.0)
        } finally {store.db.close();context.deleteDatabase(name)}
    }
}
