-- AI office: tasks handed to the office's AI staff and the files they deliver.
CREATE TABLE IF NOT EXISTS public.office_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 number integer NOT NULL CHECK(number>0),
 category text NOT NULL CHECK(category IN('design','document','spreadsheet','presentation','research','correspondence','translation','data')),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
 brief text NOT NULL DEFAULT '' CHECK(length(brief)<=8000),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','working','checking','needs_input','review','approved','failed')),
 agent_id text NOT NULL,
 decision jsonb NOT NULL,
 question text,
 answers jsonb NOT NULL DEFAULT '[]'::jsonb,
 notes jsonb NOT NULL DEFAULT '[]'::jsonb,
 revisions integer NOT NULL DEFAULT 0 CHECK(revisions>=0),
 -- The manager's check of the latest delivery, and how often the manager sent work back on its own.
 review jsonb,
 auto_revisions integer NOT NULL DEFAULT 0 CHECK(auto_revisions>=0),
 summary text,
 error text,
 cost_usd numeric(12,6) NOT NULL DEFAULT 0 CHECK(cost_usd>=0),
 created_by uuid NOT NULL REFERENCES public.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz,
 delivered_at timestamptz,
 decided_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,number)
);
CREATE INDEX IF NOT EXISTS office_tasks_recent ON public.office_tasks(tenant_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.office_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 task_id uuid NOT NULL REFERENCES public.office_tasks(id) ON DELETE CASCADE,
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 200),
 content_type text NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes>=0),
 storage_key text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS office_files_task ON public.office_files(tenant_id,task_id,revision);
