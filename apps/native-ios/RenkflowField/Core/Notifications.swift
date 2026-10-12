import Foundation
import UserNotifications
struct NotificationPreferences:Codable {var assignment:Bool;var mention:Bool;var delay:Bool}
struct FieldNotification:Codable,Identifiable {var id:String;var kind:String;var read:Bool;var createdAt:String}
struct NotificationList:Codable {var provider:String;var notifications:[FieldNotification]}
struct PushDeviceStatus:Decodable {var registered:Bool;var provider:String}
struct PushDeviceInput:Encodable {var deviceId:String;var enabled:Bool;var token:String}
func deviceIdentity() throws -> String {
    let vault=SecureVault();if let saved=vault.read("device-id",as:String.self),UUID(uuidString:saved) != nil {return saved}
    let id=UUID().uuidString;try vault.save("device-id",value:id);return id
}
/** Bridge for a configured APNs didRegisterForRemoteNotifications callback. No live provider. */
final class ApnsRegistration {
    let connected=false
    private let api=FieldAPI.live()
    func register(_ auth:Session,token:Data) async throws {
        let bytes=token.map {String(format:"%02x",$0)}.joined()
        let _:PushDeviceStatus=try await api.post(auth,path:"notifications/device",value:PushDeviceInput(deviceId:try deviceIdentity(),enabled:true,token:bytes),type:PushDeviceStatus.self)
    }
}
func showLocalNotification() async throws -> Bool {
    let center=UNUserNotificationCenter.current()
    guard try await center.requestAuthorization(options:[.alert,.sound,.badge]) else {return false}
    let content=UNMutableNotificationContent();content.title=L("text_renkflow_saha_671f9");content.body=L("text_yerel_bildirim_testi_0f5dc");content.sound = .default
    try await center.add(UNNotificationRequest(identifier:"field-local-test",content:content,trigger:UNTimeIntervalNotificationTrigger(timeInterval:1,repeats:false)))
    return true
}
