// Recovery copy from recorded source and the fractional-discount correction.
package com.renkflow.field.ui

import com.renkflow.field.data.*
import kotlinx.serialization.json.*
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale
import java.util.UUID

internal fun JsonElement.pick(vararg keys:String):String? {keys.forEach {key->text(key)?.takeIf(String::isNotBlank)?.let {return it}};return null}
internal fun JsonElement.decimal(vararg keys:String):BigDecimal?=pick(*keys)?.toBigDecimalOrNull()
internal val JsonElement.entity:JsonElement get()=if(this["data"] is JsonObject) this["data"] else this
internal fun nativeMoney(value:BigDecimal,currency:String="TRY"):String=runCatching {NumberFormat.getCurrencyInstance(Locale.forLanguageTag("tr-TR")).apply {this.currency=Currency.getInstance(currency);maximumFractionDigits=2}.format(value)}.getOrElse {"$value $currency"}
internal fun nativeDecimal(value:String):BigDecimal?=value.trim().replace(" ","").replace(',','.').takeIf {it.matches(Regex("-?[0-9]+(?:\\.[0-9]+)?"))}?.toBigDecimalOrNull()
internal fun nativeStatus(value:String):String=mapOf("pending" to "Bekliyor","new" to "Yeni","pending_approval" to "Onay bekliyor","approved" to "Onaylandı","preparing_materials" to "Malzeme hazırlığı","ready_for_production" to "Üretime hazır","in_production" to "Üretimde","quality_check" to "Kalite kontrol","ready" to "Hazır","ready_for_shipment" to "Sevkiyata hazır","shipped" to "Sevk edildi","delivered" to "Teslim edildi","completed" to "Tamamlandı","cancelled" to "İptal","on_hold" to "Beklemede","draft" to "Taslak","sent" to "Gönderildi","accepted" to "Kabul edildi","rejected" to "Reddedildi","expired" to "Süresi doldu","converted" to "Siparişe dönüştü","open" to "Açık","in_progress" to "Devam ediyor","planned" to "Planlandı","done" to "Tamamlandı","paid" to "Ödendi","issued" to "Düzenlendi","overdue" to "Gecikmiş","blocked" to "Bloke")[value] ?: value
internal fun paymentLabel(value:String)=mapOf("cash" to "Nakit","bank_transfer" to "Banka havalesi","credit_card" to "Kredi kartı","check" to "Çek","other" to "Diğer")[value] ?: value
internal data class NativeCustomer(val raw:JsonElement) {
    val id=raw.text("id").orEmpty();val name=raw.pick("full_name","fullName").orEmpty();val company=raw.pick("company_name","companyName").orEmpty();val phone=raw.text("phone").orEmpty();val email=raw.text("email").orEmpty()
}
internal data class NativeOrder(val raw:JsonElement) {
    val id=raw.text("id").orEmpty();val number=raw.pick("orderNumber","order_number").orEmpty();val customer=raw.pick("customerName","customer_name").orEmpty();val product=raw.pick("productName","product_name").orEmpty();val status=raw.text("status") ?: "pending";val currency=raw.text("currency") ?: "TRY";val total=raw.decimal("totalAmount","total_amount");val quantity=raw.number("quantity")?.toInt() ?: 0;val delivery=raw.pick("deliveryDate","delivery_date");val items=raw["items"].rows()
}
internal data class NativeLine(val id:String=UUID.randomUUID().toString(),val name:String="",val quantity:String="1",val price:String="0",val color:String="",val width:String="",val height:String="",val discount:String="0",val note:String="") {
    val amount:BigDecimal get()=(nativeDecimal(quantity) ?: BigDecimal.ZERO)*(nativeDecimal(price) ?: BigDecimal.ZERO)*(BigDecimal.ONE-(nativeDecimal(discount) ?: BigDecimal.ZERO).coerceIn(BigDecimal.ZERO,BigDecimal(100)).divide(BigDecimal(100),java.math.MathContext.DECIMAL128))
    fun payload(quotation:Boolean):JsonElement {
        val qty=quantity.toIntOrNull();val unit=nativeDecimal(price)
        require(name.isNotBlank() && qty!=null && qty in 1..10000 && unit!=null && unit>=BigDecimal.ZERO) {"Ürün adı, pozitif tam sayı miktar ve geçerli birim fiyat girin."}
        return buildJsonObject {
            put("productName",name.trim());put("quantity",qty);put("unitPrice",JsonPrimitive(unit));put("totalPrice",JsonPrimitive(amount))
            if(color.isNotBlank()) put("color",color)
            if(note.isNotBlank()) put("notes",note)
            listOf("widthMm" to width,"heightMm" to height).forEach {(key,value)->if(value.isNotBlank()) {val n=nativeDecimal(value);require(n!=null && n>BigDecimal.ZERO) {"Ölçüler pozitif olmalıdır."};put(key,JsonPrimitive(n))}}
            if(quotation) {val d=nativeDecimal(discount);require(d!=null && d>=BigDecimal.ZERO && d<=BigDecimal(100)) {"İskonto 0–100 arasında olmalıdır."};put("discountPercent",JsonPrimitive(d))}
        }
    }
}
