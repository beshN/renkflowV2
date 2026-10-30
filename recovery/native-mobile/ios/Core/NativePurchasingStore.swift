// Recovery copy from the coding session transcript; local disk could not be re-read.
import Foundation
import Combine

@MainActor final class NativePurchasingStore:ObservableObject {
    private var generation=0
    @Published var data:JSONValue = .null
    @Published var loading=false
    @Published var error:String?
    var suppliers:[JSONValue] {data["suppliers"].array}
    var orders:[JSONValue] {data["orders"].array}
    var receipts:[JSONValue] {data["receipts"].array}
    var items:[JSONValue] {data["items"].array}
    var warehouses:[JSONValue] {data["warehouses"].array}
    func load(_ workspace:WorkspaceStore) async {
        generation+=1;let epoch=generation;loading=true;error=nil
        do {let result=try await workspace.perform("/api/v1/procurement/workspace").entity;guard epoch==generation,!Task.isCancelled else {return};data=result}
        catch {if epoch==generation && !(error is CancellationError) {self.error=error.localizedDescription}}
        if epoch==generation {loading=false}
    }
    func command(_ workspace:WorkspaceStore,_ action:String,_ data:JSONValue,key:String) async throws -> JSONValue {
        try await workspace.perform("/api/v1/production",method:"POST",body:.object(["commandId":.string(key),"action":.string(action),"data":data]))
    }
}
func purchasingStatus(_ value:String)->String {["draft":"Taslak","submitted":"Onaylandı","partially_received":"Kısmi kabul","received":"Teslim alındı","cancelled":"İptal","reversed":"Geri alındı"][value] ?? value}

struct NativePurchaseDraftLine:Identifiable {
    var id=UUID()
    var item:JSONValue = .null
    var warehouse=""
    var quantity="1"
    var price="0"
    var length="6000"
    var color="Boyasız"
    var isProfile:Bool {item["stock_uom"].string=="m"}
    var amount:Decimal {(decimalInput(quantity) ?? 0)*(decimalInput(price) ?? 0)*(isProfile ? (decimalInput(length) ?? 0)/1000 : 1)}
    func payload() throws -> JSONValue {
        guard let itemId=item["id"].string,UUID(uuidString:warehouse) != nil,let qty=decimalInput(quantity),qty>0,qty<=1000000,let price=decimalInput(price),price>=0,price<=1000000 else {throw FieldAPIError(status:400,message:"Malzeme, depo, pozitif miktar ve geçerli birim fiyat girin.")}
        if isProfile || ["adet","takım","set","pcs"].contains(item["stock_uom"].string ?? "") {guard Int(quantity) != nil else {throw FieldAPIError(status:400,message:"Adet ve çubuk miktarı tam sayı olmalıdır.")}}
        var result:[String:JSONValue]=["itemId":.string(itemId),"warehouseId":.string(warehouse),"quantity":.number(NSDecimalNumber(decimal:qty).doubleValue),"unitPrice":.number(NSDecimalNumber(decimal:price).doubleValue)]
        if isProfile {guard let length=Int(length),(100...30000).contains(length),!color.trimmingCharacters(in:.whitespaces).isEmpty else {throw FieldAPIError(status:400,message:"Profil için 100–30.000 mm boy ve renk girin.")};result["lengthMm"] = .number(Double(length));result["color"] = .string(color.trimmingCharacters(in:.whitespaces))}
        return .object(result)
    }
}
