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
      <PageHeader eyebrow="Yeni kayıt" title="Yeni Sipariş" description="Temel bilgileri şimdi girin veya PDF analizinin doldurmasına bırakın." />
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
            <label className="full">Notlar<textarea name="notes" rows={5} placeholder="Sipariş geneli notları" /></label>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
