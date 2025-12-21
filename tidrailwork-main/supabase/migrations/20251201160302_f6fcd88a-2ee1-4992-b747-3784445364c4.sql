CREATE TABLE IF NOT EXISTS public.scheduled_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  subproject_id UUID,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  FOREIGN KEY (subproject_id) REFERENCES public.subprojects(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

ALTER TABLE public.scheduled_assignments ENABLE ROW LEVEL SECURITY;