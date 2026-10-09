package com.renkflow.field.data
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Test
import org.junit.Assert.*
class FieldModelTest {
    @Test fun sequentialInstallationOverlaySurvivesRepeatedCacheRestoration() {
        val base=InstallationDetails("i","planned",1,emptyList(),emptyList())
        fun row(action:String,version:Int,kind:String?=null,text:String?=null):OutboxRecord {
            val request=SyncRequest("id-$version","installation",buildJsonObject {put("action",action);put("expectedVersion",version);if(kind!=null) put("kind",kind);if(text!=null) put("text",text)},installationId="i")
            return OutboxRecord(scope="scope",commandId=request.idempotencyKey,kind=request.kind,payload=fieldJson.encodeToString(request))
        }
        val rows=listOf(row("start",1),row("issue",2,"damage","Paint scratched"))
        val result=overlayInstallation(base,rows)
        assertEquals("in_progress",result.status);assertEquals(3,result.version);assertEquals(1,result.issues.size)
        assertEquals(result,overlayInstallation(result,rows))
        assertEquals(base,overlayInstallation(base,rows.map {it.copy(state="conflict")}))
    }
    @Test fun previousQueuePhotoSchemaDecodesAndNewInstallationTargetStaysExclusive() {
        val legacy=fieldJson.decodeFromString<LocalPhoto>("""{"workOrderId":"job","base64":"/9g="}""")
        assertEquals("job",legacy.workOrderId);assertNull(legacy.installationId)
        val photo=fieldJson.encodeToJsonElement(LocalPhoto(base64="/9g=",installationId="i")).jsonObject
        assertFalse(photo.containsKey("workOrderId"));assertEquals("i",photo["installationId"]?.jsonPrimitive?.content)
    }
}
