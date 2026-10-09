package com.renkflow.field.data
/** No strings, identities, URLs, notes, images or credentials can enter the telemetry boundary. */
enum class FieldEvent { APP_OPENED, QUEUE_SAVED, SYNC_ACCEPTED, SYNC_CONFLICT, NETWORK_UNAVAILABLE, STORAGE_UNAVAILABLE }
interface FieldTelemetry {val connected:Boolean;fun event(value:FieldEvent);fun fault(value:FieldEvent)}
object DisconnectedTelemetry:FieldTelemetry {override val connected=false;override fun event(value:FieldEvent)=Unit;override fun fault(value:FieldEvent)=Unit}
