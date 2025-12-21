-- Add company_id column to fortnox_salary_codes for custom codes
ALTER TABLE fortnox_salary_codes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);

-- Allow admins to manage their company's custom salary codes
CREATE POLICY "Admins can insert company salary codes"
ON fortnox_salary_codes
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Admins can update company salary codes"
ON fortnox_salary_codes
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Admins can delete company salary codes"
ON fortnox_salary_codes
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

-- Update SELECT policy to include company-specific codes
DROP POLICY IF EXISTS "All authenticated users can view salary codes" ON fortnox_salary_codes;
CREATE POLICY "Users can view global and company salary codes"
ON fortnox_salary_codes
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (company_id IS NULL OR company_id = get_user_company_id(auth.uid()))
);