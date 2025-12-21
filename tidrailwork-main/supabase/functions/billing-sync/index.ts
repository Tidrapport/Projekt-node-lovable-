import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    // GET: Fetch all companies with subscription info
    if (req.method === 'GET') {
      if (action === 'companies') {
        console.log('Fetching all companies with subscription info')
        
        const { data: companies, error } = await supabase
          .from('companies')
          .select('id, name, slug, company_code, subscription_plan, billing_email, monthly_price_per_user, billing_start_date, created_at')
        
        if (error) {
          console.error('Error fetching companies:', error)
          throw error
        }

        // Get user counts for each company
        const companiesWithUsers = await Promise.all(
          companies.map(async (company) => {
            const { count } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('company_id', company.id)
            
            return {
              ...company,
              user_count: count || 0
            }
          })
        )

        console.log(`Found ${companiesWithUsers.length} companies`)
        return new Response(JSON.stringify({ success: true, data: companiesWithUsers }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (action === 'billing-records') {
        const companyId = url.searchParams.get('company_id')
        
        let query = supabase
          .from('billing_records')
          .select('*, companies(name)')
          .order('billing_month', { ascending: false })
        
        if (companyId) {
          query = query.eq('company_id', companyId)
        }

        const { data, error } = await query

        if (error) {
          console.error('Error fetching billing records:', error)
          throw error
        }

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // POST: Update company subscription or create billing record
    if (req.method === 'POST') {
      const body = await req.json()

      if (action === 'update-subscription') {
        const { company_id, subscription_plan, billing_email, monthly_price_per_user, billing_start_date } = body
        
        console.log(`Updating subscription for company ${company_id}:`, { subscription_plan, billing_email })

        const { data, error } = await supabase
          .from('companies')
          .update({
            subscription_plan,
            billing_email,
            monthly_price_per_user,
            billing_start_date
          })
          .eq('id', company_id)
          .select()
          .single()

        if (error) {
          console.error('Error updating subscription:', error)
          throw error
        }

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (action === 'create-billing-record') {
        const { company_id, billing_month, user_count, plan, amount } = body

        console.log(`Creating billing record for company ${company_id}:`, { billing_month, user_count, amount })

        const { data, error } = await supabase
          .from('billing_records')
          .upsert({
            company_id,
            billing_month,
            user_count,
            plan,
            amount,
            status: 'pending'
          }, { onConflict: 'company_id,billing_month' })
          .select()
          .single()

        if (error) {
          console.error('Error creating billing record:', error)
          throw error
        }

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (action === 'mark-paid') {
        const { billing_record_id } = body

        const { data, error } = await supabase
          .from('billing_records')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', billing_record_id)
          .select()
          .single()

        if (error) {
          console.error('Error marking as paid:', error)
          throw error
        }

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Webhook for user count changes (called from AdminHub)
      if (action === 'user-count-update') {
        const { company_id } = body

        // Get current user count
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company_id)

        // Get company subscription info
        const { data: company } = await supabase
          .from('companies')
          .select('subscription_plan, monthly_price_per_user')
          .eq('id', company_id)
          .single()

        console.log(`User count update for company ${company_id}: ${count} users`)

        return new Response(JSON.stringify({ 
          success: true, 
          data: { 
            company_id, 
            user_count: count || 0,
            subscription_plan: company?.subscription_plan,
            monthly_price_per_user: company?.monthly_price_per_user
          } 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Billing sync error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})