-- Add policy for super admins to manage all subprojects
CREATE POLICY "Super admins can manage all subprojects"
ON public.subprojects
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));