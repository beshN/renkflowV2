package com.renkflow.field.data

import android.content.Context
import androidx.room.*
import androidx.room.withTransaction
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.jsonObject
import java.security.MessageDigest

fun sessionScope(session: Session): String = MessageDigest.getInstance("SHA-256")
    .digest("${session.server.trimEnd('/')}|${session.user.tenantId}|${session.user.id}".toByteArray()).joinToString("") { "%02x".format(it) }

@Entity(tableName = "field_cache", primaryKeys = ["scope", "cacheKey"])
data class CachedRecord(val scope: String, val cacheKey: String, val payload: String, val savedAt: Long)
@Entity(tableName = "field_outbox", indices = [Index(value = ["commandId"], unique = true), Index(value = ["scope", "sequence"])])
data class OutboxRecord(
    @PrimaryKey(autoGenerate = true) val sequence: Long = 0, val scope: String, val commandId: String,
    val kind: String, val payload: String, val position: Long = 0, val state: String = "pending", val attempts: Int = 0,
    val nextAttemptAt: Long = 0, val reason: String? = null, val canRetry: Boolean = false,
    val resultURL: String? = null, val createdAt: Long = System.currentTimeMillis()
)
@Dao interface OfflineDAO {
    @Query("SELECT * FROM field_cache WHERE scope=:scope AND cacheKey=:key") suspend fun cache(scope: String, key: String): CachedRecord?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun cache(record: CachedRecord)
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insert(record: OutboxRecord): Long
    @Query("SELECT COALESCE(MAX(position),0)+1 FROM field_outbox") suspend fun nextPosition(): Long
    @Transaction suspend fun enqueue(record: OutboxRecord): Long = insert(record.copy(position=if(record.position==0L) nextPosition() else record.position))
    @Update suspend fun update(record: OutboxRecord)
    @Query("SELECT * FROM field_outbox WHERE scope=:scope AND state!='delivered' ORDER BY position, sequence") fun watch(scope: String): Flow<List<OutboxRecord>>
    @Query("SELECT * FROM field_outbox WHERE scope=:scope AND state!='delivered' ORDER BY position, sequence") suspend fun pending(scope: String): List<OutboxRecord>
    @Query("SELECT * FROM field_outbox WHERE scope=:scope AND commandId=:id") suspend fun find(scope: String,id: String): OutboxRecord?
    @Query("UPDATE field_outbox SET state='pending' WHERE state='sending'") suspend fun recoverInterrupted()
    @Query("DELETE FROM field_cache WHERE scope=:scope") suspend fun clearCache(scope: String)
    @Query("DELETE FROM field_outbox WHERE state='delivered' AND createdAt<:before AND kind!='photo'") suspend fun trimDelivered(before: Long)
}
@Database(entities = [CachedRecord::class, OutboxRecord::class], version = 1, exportSchema = true)
abstract class OfflineDatabase : RoomDatabase() { abstract fun dao(): OfflineDAO }

class OfflineStore(val db: OfflineDatabase) {
    val dao = db.dao()
    private var recovered = false
    private val initialization = Mutex()
    suspend fun prepare() = initialization.withLock { if (!recovered) { dao.recoverInterrupted(); recovered = true } }
    suspend fun save(scope: String,key: String,json: String) = dao.cache(CachedRecord(scope,key,json,System.currentTimeMillis()))
    suspend fun enqueue(scope: String,request: SyncRequest) = dao.enqueue(OutboxRecord(scope=scope,commandId=request.idempotencyKey,kind=request.kind,payload=fieldJson.encodeToString(request)))
    suspend fun enqueueWithCache(scope: String,request: SyncRequest,updates: Map<String,String>) = db.withTransaction {
        val inserted=enqueue(scope,request)
        check(inserted!=-1L || dao.find(scope,request.idempotencyKey)?.payload==fieldJson.encodeToString(request)) { "Yerel işlem kimliği çakıştı." }
        updates.forEach { (key,value)->save(scope,key,value) }
    }
    suspend fun migrateLegacy(session: Session,command: Command?) {
        if(command != null) enqueueWithCache(sessionScope(session),SyncRequest(command.commandId,"operation",fieldJson.encodeToJsonElement(OperationInput.serializer(),command.data).jsonObject),emptyMap())
    }
    companion object {
        @Volatile private var instance: OfflineStore? = null
        fun get(context: Context): OfflineStore = instance ?: synchronized(this) {
            instance ?: OfflineStore(Room.databaseBuilder(context.applicationContext,OfflineDatabase::class.java,"renkflow-field.db").build()).also { instance = it }
        }
    }
}
