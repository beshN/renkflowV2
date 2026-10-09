import XCTest
@testable import RenkflowField
@MainActor final class FieldModelTests:XCTestCase {
    func testSequentialInstallationOverlaySurvivesRepeatedRestoration() throws {
        let base=InstallationDetails(id:"i",status:"planned",version:1,checklist:[],issues:[])
        func row(_ action:String,_ version:Int,kind:String?=nil,text:String?=nil) throws -> OutboxRecord {
            var data:[String:JSONValue]=["action":.string(action),"expectedVersion":.number(Double(version))]
            if let kind {data["kind"] = .string(kind)};if let text {data["text"] = .string(text)}
            let request=SyncRequest(idempotencyKey:"id-\(version)",kind:"installation",data:data,workOrderId:nil,installationId:"i")
            return OutboxRecord(id:request.idempotencyKey,sequence:Int64(version),scope:"scope",kind:"installation",payload:try JSONEncoder().encode(request))
        }
        let rows=try [row("start",1),row("issue",2,kind:"damage",text:"Paint scratched")],result=overlayInstallation(base,rows:rows)
        XCTAssertEqual(result.status,"in_progress");XCTAssertEqual(result.version,3);XCTAssertEqual(result.issues.count,1)
        XCTAssertEqual(overlayInstallation(result,rows:rows).issues.count,1)
        rows.forEach {$0.state="conflict"};XCTAssertEqual(overlayInstallation(base,rows:rows).version,1)
    }
    func testLegacyPhotoSchemaAndInstallationTarget() throws {
        let old=try JSONDecoder().decode(LocalPhoto.self,from:Data(#"{"workOrderId":"job","base64":"/9g="}"#.utf8))
        XCTAssertEqual(old.workOrderId,"job");XCTAssertNil(old.installationId)
        let photo=LocalPhoto(base64:"/9g=",installationId:"i"),data=try JSONSerialization.jsonObject(with:JSONEncoder().encode(photo)) as! [String:Any]
        XCTAssertNil(data["workOrderId"]);XCTAssertEqual(data["installationId"] as? String,"i")
    }
}
