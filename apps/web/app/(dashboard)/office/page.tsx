import { PageHeader } from '@/components/kit';
import { OfficeWorkspace } from '@/components/features/office/OfficeWorkspace';

export default function OfficePage() {
  return (
    <div className="rf-page mx-auto w-full max-w-[1600px] space-y-4">
      <PageHeader eyebrow="Çalışma alanı" title="AI ofis" hint="Görevi kendi cümlelerinizle yazın; ofis müdürü türüne ve zorluğuna karar verip uygun çalışana verir, iş bitince dosya olarak teslim edilir." />
      <OfficeWorkspace />
    </div>
  );
}
