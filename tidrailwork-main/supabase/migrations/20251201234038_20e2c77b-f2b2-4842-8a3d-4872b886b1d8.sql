-- Add policy for super admins to manage all projects (including delete)
CREATE POLICY "Super admins can manage all projects"
ON public.projects
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));