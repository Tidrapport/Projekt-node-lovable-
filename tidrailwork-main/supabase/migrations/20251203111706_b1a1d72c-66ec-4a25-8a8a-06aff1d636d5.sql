-- Allow users to view profiles of colleagues in their company
CREATE POLICY "Users can view company colleagues profiles"
ON public.profiles
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));