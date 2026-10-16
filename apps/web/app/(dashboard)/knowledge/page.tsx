import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { KnowledgeWorkspace } from '@/components/features/knowledge/KnowledgeWorkspace';
export default function KnowledgePage() {
  return (
    <>
      <AppleNavbar title="Bilgi bankası" />
      <KnowledgeWorkspace />
    </>
  );
}
