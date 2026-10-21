CREATE TABLE IF NOT EXISTS public.knowledge_categories (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,name),UNIQUE(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 category_id uuid,title text NOT NULL CHECK(length(title) BETWEEN 1 AND 180),content text NOT NULL DEFAULT '',
 visibility text NOT NULL CHECK(visibility IN('company','office','managers')),version integer NOT NULL DEFAULT 1 CHECK(version>0),
 archived boolean NOT NULL DEFAULT false,created_by uuid NOT NULL REFERENCES users(id),updated_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,category_id) REFERENCES knowledge_categories(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.knowledge_revisions (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),tenant_id uuid NOT NULL REFERENCES tenants(id),document_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),title text NOT NULL,content text NOT NULL,category_id uuid,
 visibility text NOT NULL CHECK(visibility IN('company','office','managers')),file_path text,file_name text,mime text,size_bytes integer,
 note text NOT NULL DEFAULT '',created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,document_id) REFERENCES knowledge_documents(tenant_id,id),
 UNIQUE(document_id,version),UNIQUE(file_path),CHECK(file_path IS NULL OR (file_name IS NOT NULL AND mime IS NOT NULL AND size_bytes>0))
);
-- File paths may be reused by a new revision when only its text or metadata changes.
ALTER TABLE public.knowledge_revisions DROP CONSTRAINT IF EXISTS knowledge_revisions_file_path_key;
CREATE INDEX IF NOT EXISTS knowledge_documents_company ON knowledge_documents(tenant_id,archived,updated_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_documents_search ON knowledge_documents USING gin(to_tsvector('simple',title || ' ' || content));
CREATE INDEX IF NOT EXISTS knowledge_revisions_storage ON knowledge_revisions(file_path) WHERE file_path IS NOT NULL;
CREATE OR REPLACE FUNCTION public.keep_knowledge_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Knowledge revisions are immutable'; END $$;
DROP TRIGGER IF EXISTS knowledge_revisions_immutable ON public.knowledge_revisions;
CREATE TRIGGER knowledge_revisions_immutable BEFORE UPDATE OR DELETE ON public.knowledge_revisions FOR EACH ROW EXECUTE FUNCTION public.keep_knowledge_revision();
