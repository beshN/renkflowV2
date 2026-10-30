// Recovery copy from recorded source plus the city/district additions.
import Foundation

struct NativeCustomer:Identifiable {
    let id:String
    var name:String
    var company:String
    var email:String
    var phone:String
    var address:String
    var city:String
    var district:String
    var taxNumber:String
    var taxOffice:String
    var billingAddress:String
    var shippingAddress:String
    var notes:String
    var paymentTerms:Int
    var creditLimit:Decimal?
    var orderCount:Int
    var revenue:Decimal?
    var contacts:[JSONValue]
    init?(_ value:JSONValue) {
        guard let id=value["id"].string else {return nil};self.id=id
        name=value.text("full_name","fullName") ?? "";company=value.text("company_name","companyName") ?? ""
        email=value["email"].string ?? "";phone=value["phone"].string ?? "";address=value["address"].string ?? ""
        city=value["city"].string ?? "";district=value["district"].string ?? ""
        taxNumber=value.text("tax_number","taxNumber") ?? "";taxOffice=value.text("tax_office","taxOffice") ?? ""
        billingAddress=value.text("billing_address","billingAddress") ?? "";shippingAddress=value.text("shipping_address","shippingAddress") ?? ""
        notes=value["notes"].string ?? "";paymentTerms=Int(value["payment_terms"].number ?? 30)
        creditLimit=value.decimal("credit_limit");orderCount=Int(value["order_count"].number ?? 0);revenue=value.decimal("total_revenue");contacts=value["contacts"].array
    }
}
struct NativeOrder:Identifiable {
    let id:String
    var number:String
    var customer:String
    var product:String
    var status:String
    var currency:String
    var total:Decimal?
    var quantity:Int
    var delivery:String?
    var email:String
    var phone:String
    var notes:String
    var items:[JSONValue]
    var raw:JSONValue
    init?(_ value:JSONValue) {
        guard let id=value["id"].string else {return nil};self.id=id;raw=value
        number=value.text("orderNumber","order_number") ?? "";customer=value.text("customerName","customer_name") ?? ""
        product=value.text("productName","product_name") ?? "";status=value["status"].string ?? "pending"
        currency=value["currency"].string ?? "TRY";total=value.decimal("totalAmount","total_amount")
        quantity=Int(value["quantity"].number ?? 0);delivery=value.text("deliveryDate","delivery_date")
        email=value["email"].string ?? "";phone=value["phone"].string ?? "";notes=value["notes"].string ?? "";items=value["items"].array
    }
}
struct NativeCommerceLine:Identifiable {
    var id=UUID()
    var name=""
    var description=""
    var quantity="1"
    var unitPrice="0"
    var color=""
    var width=""
    var height=""
    var discount="0"
    var notes=""
    var amount:Decimal {max(0,decimalInput(quantity) ?? 0)*max(0,decimalInput(unitPrice) ?? 0)*(1-min(100,max(0,decimalInput(discount) ?? 0))/100)}
    init() {}
    init(_ value:JSONValue) {
        name=value.text("productName","product_name") ?? "";description=value["description"].string ?? ""
        quantity=value["quantity"].string ?? "1";unitPrice=value.text("unitPrice","unit_price") ?? "0"
        color=value["color"].string ?? "";width=value["widthMm"].string ?? "";height=value["heightMm"].string ?? ""
        discount=value["discountPercent"].string ?? "0";notes=value["notes"].string ?? ""
    }
    func payload(quotation:Bool=false) throws -> JSONValue {
        guard !name.trimmingCharacters(in:.whitespaces).isEmpty,let qty=Int(quantity),qty>0,qty<=10000,let price=decimalInput(unitPrice),price>=0 else {throw FieldAPIError(status:400,message:"Ürün adı, pozitif tam sayı miktar ve geçerli birim fiyat girin.")}
        var result:[String:JSONValue]=["productName":.string(name.trimmingCharacters(in:.whitespaces)),"quantity":.number(Double(qty)),"unitPrice":.number(NSDecimalNumber(decimal:price).doubleValue),"totalPrice":.number(NSDecimalNumber(decimal:amount).doubleValue)]
        for (key,value) in [("description",description),("color",color),("notes",notes)] where !value.isEmpty {result[key] = .string(value)}
        for (key,value) in [("widthMm",width),("heightMm",height)] where !value.isEmpty {guard let number=decimalInput(value),number>0 else {throw FieldAPIError(status:400,message:"Ölçüler pozitif olmalıdır.")};result[key] = .number(NSDecimalNumber(decimal:number).doubleValue)}
        if quotation {guard let discount=decimalInput(discount),discount>=0,discount<=100 else {throw FieldAPIError(status:400,message:"İskonto 0–100 aralığında olmalıdır.")};result["discountPercent"] = .number(NSDecimalNumber(decimal:discount).doubleValue)}
        return .object(result)
    }
}
func decimalInput(_ value:String)->Decimal? {
    let cleaned=value.trimmingCharacters(in:.whitespacesAndNewlines).replacingOccurrences(of:" ",with:"").replacingOccurrences(of:",",with:".")
    guard !cleaned.isEmpty,cleaned.range(of:"^-?[0-9]+(?:\\.[0-9]+)?$",options:.regularExpression) != nil else {return nil}
    return Decimal(string:cleaned,locale:Locale(identifier:"en_US_POSIX"))
}
