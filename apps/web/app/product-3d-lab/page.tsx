import { notFound } from "next/navigation";
import { ProductLab } from "@/components/features/product-3d/ProductLab";
import { ProductKindSchema } from "@/lib/features/product-3d/catalog";
export default async function Product3DLab({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const parsed = ProductKindSchema.safeParse(
    (await searchParams).product ?? "pergola",
  );
  return (
    <main className="mx-auto max-w-[1500px] p-6">
      <h1 className="mb-6 text-xl font-semibold">Renk · Ürün 3D inceleme</h1>
      <ProductLab kind={parsed.success ? parsed.data : "pergola"} />
    </main>
  );
}
