-- Allow admins to create time entries for users in their company
CREATE POLICY "Admins can create company time entries"
ON public.time_entries
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);