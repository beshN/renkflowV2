package com.renkflow.field.data

import androidx.room.Room
import androidx.room.withTransaction
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.*
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import java.io.IOException
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class OfflineStoreTest {
    private val context=InstrumentationRegistry.getInstrumentation().targetContext
    private lateinit var store: OfflineStore
    private lateinit var name: String
    @Before fun setup() {name="offline-test-${UUID.randomUUID()}.db";store=open()}
    @After fun cleanup() {store.db.close();context.deleteDatabase(name)}
    private fun open()=OfflineStore(Room.databaseBuilder(context,OfflineDatabase::class.java,name).build())
    private fun request()=SyncRequest(UUID.randomUUID().toString(),"comment",buildJsonObject {put("body","Persisted offline note")},UUID.randomUUID().toString())
    @Test fun restartRetainsCacheQueueAndScope()=runBlocking {
        val value=request();store.enqueueWithCache("scope-A",value,mapOf("snapshot" to "{\"technical\":true}"))
        store.db.close();store=open();store.prepare()
        assertEquals(value.idempotencyKey,store.dao.pending("scope-A").single().commandId)
        assertNotNull(store.dao.cache("scope-A","snapshot"));assertNull(store.dao.cache("scope-B","snapshot"));assertTrue(store.dao.pending("scope-B").isEmpty())
    }
    @Test fun offlineReconnectAndDoubleDrainDeliverOnce()=runBlocking {
        val value=request();store.enqueue("scope",value)
        OutboxSync(store,object:OutboxSender {override suspend fun send(record:OutboxRecord):String? {throw IOException("offline")}}).drain("scope")
        val interrupted=store.dao.pending("scope").single();assertEquals("pending",interrupted.state);assertEquals(1,interrupted.attempts)
        store.db.close();store=open();store.dao.update(interrupted.copy(nextAttemptAt=0));var sends=0
        val sender=object:OutboxSender {override suspend fun send(record:OutboxRecord):String? {sends++;return null}}
        coroutineScope {awaitAll(async {OutboxSync(store,sender).drain("scope")},async {OutboxSync(store,sender).drain("scope")})}
        assertEquals(1,sends);assertTrue(store.dao.pending("scope").isEmpty());assertEquals("delivered",store.dao.find("scope",value.idempotencyKey)?.state)
    }
    @Test fun cancellationRestoresPendingRowBeforeTheCoroutineExits()=runBlocking {
        val value=request();store.enqueue("scope",value)
        val entered=CompletableDeferred<Unit>()
        val drain=launch {OutboxSync(store,object:OutboxSender {
            override suspend fun send(record:OutboxRecord):String? {entered.complete(Unit);awaitCancellation()}
        }).drain("scope")}
        entered.await();drain.cancelAndJoin()
        val pending=store.dao.find("scope",value.idempotencyKey)!!
        assertEquals("pending",pending.state);assertEquals(value.idempotencyKey,pending.commandId)
        var delivered=0
        OutboxSync(store,object:OutboxSender {override suspend fun send(record:OutboxRecord):String? {delivered++;return null}}).drain("scope")
        assertEquals(1,delivered);assertEquals("delivered",store.dao.find("scope",value.idempotencyKey)?.state)
    }
    @Test fun recoveryRetriesSendingWithSameUUID()=runBlocking {
        val value=request();store.enqueue("scope",value);val row=store.dao.pending("scope").single();store.dao.update(row.copy(state="sending"))
        store.db.close();store=open();store.prepare();assertEquals("pending",store.dao.pending("scope").single().state);assertEquals(value.idempotencyKey,store.dao.pending("scope").single().commandId)
    }
    @Test fun duplicateEnqueueAndLegacyMigrationKeepOneIdentity()=runBlocking {
        val auth=Session("https://renkflow.com","test",Long.MAX_VALUE,User("u","test@example.invalid",null,"worker","t"))
        val legacy=Command(UUID.randomUUID().toString(),data=OperationInput(UUID.randomUUID().toString(),1,"start"))
        store.migrateLegacy(auth,legacy);store.migrateLegacy(auth,legacy)
        assertEquals(1,store.dao.pending(sessionScope(auth)).size);assertEquals(legacy.commandId,store.dao.pending(sessionScope(auth)).single().commandId)
    }
    @Test fun corruptPartialQueueIsQuarantinedAndSurvivesRestart()=runBlocking {
        store.dao.enqueue(OutboxRecord(scope="scope",commandId=UUID.randomUUID().toString(),kind="comment",payload="{broken"))
        var sends=0;OutboxSync(store,object:OutboxSender {override suspend fun send(record:OutboxRecord):String? {sends++;return null}}).drain("scope")
        assertEquals(0,sends);assertEquals("corrupt",store.dao.pending("scope").single().state)
        store.db.close();store=open();store.prepare();assertEquals("{broken",store.dao.pending("scope").single().payload)
    }
    @Test fun conflictDoesNotOverwriteOrAutomaticallyReplay()=runBlocking {
        store.enqueue("scope",request());var sends=0
        val sender=object:OutboxSender {override suspend fun send(record:OutboxRecord):String? {sends++;throw ApiException(409,"server changed",true)}}
        OutboxSync(store,sender).drain("scope");OutboxSync(store,sender).drain("scope")
        val row=store.dao.pending("scope").single();assertEquals(1,sends);assertEquals("conflict",row.state);assertTrue(row.canRetry)
    }
    @Test fun rebasedCommandKeepsQueuePositionWithNewIdentity()=runBlocking {
        val original=request();store.enqueue("scope",original);val row=store.dao.pending("scope").single();store.dao.update(row.copy(state="conflict",canRetry=true))
        val dependent=request();store.enqueue("scope",dependent);val replacement=request()
        store.db.withTransaction {
            store.dao.enqueue(OutboxRecord(scope="scope",commandId=replacement.idempotencyKey,kind=replacement.kind,payload=fieldJson.encodeToString(SyncRequest.serializer(),replacement),position=row.position))
            store.dao.update(row.copy(state="delivered"))
        }
        assertEquals(listOf(replacement.idempotencyKey,dependent.idempotencyKey),store.dao.pending("scope").map {it.commandId})
    }
    @Test fun reassignedWriteCannotForceReplay()=runBlocking {
        store.enqueue("scope",request())
        OutboxSync(store,object:OutboxSender {override suspend fun send(record:OutboxRecord):String? {throw ApiException(404,"reassigned")}}).drain("scope")
        val row=store.dao.pending("scope").single();assertEquals("blocked",row.state);assertFalse(row.canRetry)
    }
}
