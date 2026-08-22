import { createOrder } from "@/app/actions/core";
import { PageHeader } from "@/components/page-header";
import { ActionForm } from "@/components/action-form";
import { requireOrganization } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NewOrderPage() {
  const { membership } = await requireOrganization();
  if (membership.role === "production") redirect("/panel/siparisler");
  return (
    <>
      <PageHeader eyebrow="Yeni kayıt" title="Yeni Sipariş" description="Siparişi ve kaynak PDF'yi tek adımda kaydedin; analiz otomatik başlasın." />
      <section className="form-card">
        <ActionForm
          action={createOrder}
          className="record-form"
          submitLabel="Siparişi oluştur"
          pendingLabel="Sipariş oluşturuluyor…"
          footer={<span>Sipariş taslak olarak açılacak.</span>}
        >
          <input type="hidden" name="organizationId" value={membership.organization_id} />
          <div className="form-grid">
            <label>Müşteri adı<input name="customerName" placeholder="PDF'den otomatik doldurulabilir" /></label>
            <label>Proje adı<input name="projectName" placeholder="Örn. Kuzey Cephe" /></label>
            <label>Müşteri referansı<input name="customerReference" placeholder="Sipariş / teklif numarası" /></label>
            <label>Planlanan teslim<input type="date" name="plannedDeliveryDate" /></label>
            <label className="full">Notlar<textarea name="notes" rows={5} placeholder="Sipariş geneli notları" /></label>
            <label className="full new-order-file">Kaynak sipariş PDF’i <span>İsteğe bağlı · en fazla 25 MB ve 50 sayfa</span><input type="file" name="file" accept="application/pdf,.pdf" /></label>
          </div>
          <div className="new-order-flow"><span>1</span><p><b>Sipariş açılır</b><small>Takip numarası otomatik oluşur.</small></p><i /><span>2</span><p><b>PDF analiz edilir</b><small>Alanlar insan kontrolüne hazırlanır.</small></p><i /><span>3</span><p><b>Ofis onaylar</b><small>Onaydan sonra üretime geçer.</small></p></div>
        </ActionForm>
      </section>
    </>
  );
}
