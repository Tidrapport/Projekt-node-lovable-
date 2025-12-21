
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Everyone can view active projects" ON public.projects;

-- Create new policy that restricts to same company
CREATE POLICY "Users can view their company projects" 
ON public.projects 
FOR SELECT 
USING (
  active = true 
  AND company_id = get_user_company_id(auth.uid())
);
