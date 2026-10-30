// Recovery copy from the coding session transcript; not re-read from the local filesystem.
package com.renkflow.field.ui

import androidx.compose.runtime.*
import com.renkflow.field.WorkspaceViewModel
import com.renkflow.field.data.*
import kotlinx.serialization.json.*
import java.math.BigDecimal
import java.math.MathContext
import java.util.UUID

@Stable internal class NativeProcurementData {
    var data by mutableStateOf<JsonElement>(JsonNull)
    var loading by mutableStateOf(true)
    var error by mutableStateOf<String?>(null)
    var revision by mutableIntStateOf(0)
    val suppliers get()=data["suppliers"].rows()
    val orders get()=data["orders"].rows()
    val receipts get()=data["receipts"].rows()
    val items get()=data["items"].rows()
    val warehouses get()=data["warehouses"].rows()
}
@Composable internal fun rememberProcurement(model:WorkspaceViewModel):NativeProcurementData {
    val state=remember {NativeProcurementData()}
    LaunchedEffect(state.revision) {state.loading=true;state.error=null;try {state.data=model.request("/api/v1/procurement/workspace").entity} catch(e:kotlinx.coroutines.CancellationException) {throw e} catch(e:Exception) {state.error=e.message} finally {state.loading=false}}
    return state
}
internal suspend fun WorkspaceViewModel.procurementCommand(action:String,data:JsonElement,key:String)=request("/api/v1/production","POST",buildJsonObject {put("commandId",key);put("action",action);put("data",data)})
internal fun purchasingStatus(value:String)=mapOf("draft" to "Taslak","submitted" to "Onaylandı","partially_received" to "Kısmi kabul","received" to "Teslim alındı","cancelled" to "İptal","reversed" to "Geri alındı")[value] ?: value
internal data class NativePurchaseLine(val id:String=UUID.randomUUID().toString(),val item:JsonElement=JsonNull,val warehouse:String="",val quantity:String="1",val price:String="0",val length:String="6000",val color:String="Boyasız") {
    val profile get()=item.text("stock_uom")=="m"
    val amount:BigDecimal get()=(nativeDecimal(quantity) ?: BigDecimal.ZERO)*(nativeDecimal(price) ?: BigDecimal.ZERO)*(if(profile) (nativeDecimal(length) ?: BigDecimal.ZERO).divide(BigDecimal(1000),MathContext.DECIMAL128) else BigDecimal.ONE)
    fun payload():JsonElement {
        val itemId=requireNotNull(item.text("id")) {"Malzeme seçin."};UUID.fromString(warehouse)
        val qty=nativeDecimal(quantity);val unit=nativeDecimal(price)
        require(qty!=null&&qty>BigDecimal.ZERO&&qty<=BigDecimal(1000000)&&unit!=null&&unit>=BigDecimal.ZERO&&unit<=BigDecimal(1000000)) {"Pozitif miktar ve geçerli birim fiyat girin."}
        if(profile||item.text("stock_uom") in listOf("adet","takım","set","pcs")) require(quantity.toIntOrNull()!=null) {"Adet ve çubuk miktarı tam sayı olmalıdır."}
        return buildJsonObject {put("itemId",itemId);put("warehouseId",warehouse);put("quantity",JsonPrimitive(qty));put("unitPrice",JsonPrimitive(unit));if(profile) {val mm=length.toIntOrNull();require(mm!=null&&mm in 100..30000&&color.isNotBlank()) {"Profil için 100–30.000 mm boy ve renk girin."};put("lengthMm",mm);put("color",color.trim())}}
    }
}
internal data class NativeReceiptInput(val raw:JsonElement,val accepted:String="0",val rejected:String="0",val length:String=raw["metadata"].text("lengthMm") ?: "6000",val color:String=raw["metadata"].text("color").orEmpty(),val rejectedColor:String="",val reason:String="",val rejectedWarehouse:String="") {
    val id get()=raw.text("id").orEmpty()
    val profile get()=raw.text("uom")=="m"
    val remaining:BigDecimal get()=((raw.decimal("ordered_qty") ?: BigDecimal.ZERO)-(raw.decimal("received_qty") ?: BigDecimal.ZERO)).max(BigDecimal.ZERO)
    fun payload():JsonElement? {
        val accepted=nativeDecimal(accepted);val rejected=nativeDecimal(rejected)
        require(accepted!=null&&rejected!=null&&accepted>=BigDecimal.ZERO&&rejected>=BigDecimal.ZERO) {"Kabul ve red miktarları negatif olamaz."}
        if((accepted+rejected).signum()==0) return null
        val mm=length.toIntOrNull()
        val factor=if(profile) (nativeDecimal(length) ?: BigDecimal.ZERO).divide(BigDecimal(1000),MathContext.DECIMAL128) else BigDecimal.ONE
        require((accepted+rejected)*factor<=remaining) {"Kabul ve red toplamı kalan siparişi aşamaz."}
        return buildJsonObject {
            put("lineId",id);put("acceptedQty",JsonPrimitive(accepted*factor));put("rejectedQty",JsonPrimitive(rejected*factor))
            if(rejected>BigDecimal.ZERO) {UUID.fromString(rejectedWarehouse);require(reason.trim().length>=5) {"Red deposu ve en az 5 karakter gerekçe girin."};put("rejectedWarehouseId",rejectedWarehouse);put("rejectionReason",reason.trim())}
            if(profile) {require(mm!=null&&mm in 100..30000&&this@NativeReceiptInput.accepted.toIntOrNull()!=null&&this@NativeReceiptInput.rejected.toIntOrNull()!=null&&color.isNotBlank()) {"Fiziksel çubuk adedi, boyu ve rengi girin."};put("color",color);if(rejectedColor.isNotBlank()) put("rejectedColor",rejectedColor);put("bars",buildJsonArray {listOf("accepted" to accepted,"rejected" to rejected).filter {it.second>BigDecimal.ZERO}.forEach {(disposition,count)->add(buildJsonObject {put("lengthMm",mm);put("count",JsonPrimitive(count));put("disposition",disposition)})}})}
        }
    }
}
