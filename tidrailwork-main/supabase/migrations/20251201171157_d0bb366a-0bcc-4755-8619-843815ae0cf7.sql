ALTER TABLE public.projects ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
CREATE INDEX idx_projects_company_id ON public.projects(company_id);

ALTER TABLE public.job_roles ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
CREATE INDEX idx_job_roles_company_id ON public.job_roles(company_id);

ALTER TABLE public.material_types ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
CREATE INDEX idx_material_types_company_id ON public.material_types(company_id);

ALTER TABLE public.subprojects ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
CREATE INDEX idx_subprojects_company_id ON public.subprojects(company_id);

ALTER TABLE public.time_entries ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
CREATE INDEX idx_time_entries_company_id ON public.time_entries(company_id);

ALTER TABLE public.deviation_reports ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
CREATE INDEX idx_deviation_reports_company_id ON public.deviation_reports(company_id);

ALTER TABLE public.material_reports ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
CREATE INDEX idx_material_reports_company_id ON public.material_reports(company_id);

ALTER TABLE public.scheduled_assignments ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
CREATE INDEX idx_scheduled_assignments_company_id ON public.scheduled_assignments(company_id);