import Foundation
/** Allowlisted enums only. No user/session/job IDs, text, URLs, photos or tokens. */
enum FieldEvent {case appOpened,queueSaved,syncAccepted,syncConflict,networkUnavailable,storageUnavailable}
protocol FieldTelemetry {var connected:Bool {get};func event(_ value:FieldEvent);func fault(_ value:FieldEvent)}
struct DisconnectedTelemetry:FieldTelemetry {let connected=false;func event(_ value:FieldEvent) {};func fault(_ value:FieldEvent) {}}
