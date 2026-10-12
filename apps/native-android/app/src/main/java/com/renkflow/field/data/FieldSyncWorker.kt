package com.renkflow.field.data

import android.content.Context
import androidx.work.*
import androidx.room.withTransaction
import java.util.concurrent.TimeUnit

class FieldSyncWorker(context: Context,params: WorkerParameters): CoroutineWorker(context,params) {
    override suspend fun doWork(): Result {
        val session=Vault(applicationContext).session() ?: return Result.success()
        val store=OfflineStore.get(applicationContext)
        val scope=sessionScope(session)
        return try {
            val result=OutboxSync(store,APIOutboxSender(store,SessionManager.api(applicationContext),session)).drain(scope)
            if(result.delivered>0) {
                val snapshot=SessionManager.api(applicationContext).snapshot(session)
                store.db.withTransaction {
                    store.save(scope,"snapshot",fieldJson.encodeToString(Snapshot.serializer(),snapshot))
                    snapshot.workOrders.forEach { store.save(scope,"job:${it.id}",fieldJson.encodeToString(WorkOrder.serializer(),it)) }
                }
                store.save(scope,"last-sync",System.currentTimeMillis().toString())
            }
            if(result.retry) Result.retry() else Result.success()
        } catch(e: ApiException) { if(e.status in listOf(401,403,426)) Result.failure() else Result.retry() }
        catch(e: Exception) { if(e is kotlinx.coroutines.CancellationException) throw e; Result.retry() }
    }
    companion object {
        fun schedule(context: Context) {
            val constraints=Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).setRequiresBatteryNotLow(true).build()
            val work=OneTimeWorkRequestBuilder<FieldSyncWorker>().setConstraints(constraints).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,15,TimeUnit.SECONDS).build()
            WorkManager.getInstance(context).enqueueUniqueWork("renkflow-field-outbox",ExistingWorkPolicy.KEEP,work)
        }
        fun cancel(context: Context) { WorkManager.getInstance(context).cancelUniqueWork("renkflow-field-outbox") }
    }
}
