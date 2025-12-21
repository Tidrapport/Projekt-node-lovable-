import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action, company_name, org_number, email, billing_email, package_name, admin_email, admin_user_id } = body;

    console.log('Received sync request:', { action, company_name, org_number, email, package_name, admin_email, admin_user_id });

    if (action === 'register') {
      // Check if company already exists
      const { data: existing } = await supabase
        .from('companies')
        .select('id')
        .eq('name', company_name)
        .single();

      if (existing) {
        console.log('Company already exists:', company_name);
        return new Response(
          JSON.stringify({ success: true, message: 'Company already exists', company_id: existing.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate company code and slug
      const slug = company_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      
      // Get unique company code
      const { data: codeData } = await supabase.rpc('generate_company_code');
      const companyCode = codeData || Math.random().toString(36).substring(2, 10).toUpperCase();

      // Create company
      const { data: newCompany, error: createError } = await supabase
        .from('companies')
        .insert({
          name: company_name,
          slug: slug,
          company_code: companyCode,
          org_number: org_number || null,
          billing_email: billing_email || email || admin_email || null,
          subscription_plan: 'free',
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating company:', createError);
        throw createError;
      }

      console.log('Company created successfully:', newCompany);

      // Create admin user if admin_email is provided
      let adminUserId = null;
      if (admin_email) {
        console.log('Creating admin user:', admin_email);
        
        // Generate a random password
        const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + '!';
        
        // Create user in auth.users
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: admin_email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: admin_email.split('@')[0],
            company_id: newCompany.id
          }
        });

        if (authError) {
          console.error('Error creating admin user:', authError);
          // Don't fail the whole request, company was created successfully
        } else if (authData.user) {
          adminUserId = authData.user.id;
          console.log('Admin user created:', adminUserId);

          // Update profile with company_id (trigger should have created it)
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ 
              company_id: newCompany.id,
              email: admin_email 
            })
            .eq('id', adminUserId);

          if (profileError) {
            console.error('Error updating profile:', profileError);
          }

          // Assign admin role
          const { error: roleError } = await supabase
            .from('user_roles')
            .update({ role: 'admin' })
            .eq('user_id', adminUserId);

          if (roleError) {
            console.error('Error assigning admin role:', roleError);
          } else {
            console.log('Admin role assigned to user:', adminUserId);
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          company_id: newCompany.id, 
          company_code: newCompany.company_code,
          admin_user_id: adminUserId,
          message: 'Company created' + (adminUserId ? ' with admin user' : '')
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'update') {
      // Update existing company
      const { data: company, error: findError } = await supabase
        .from('companies')
        .select('id')
        .eq('name', company_name)
        .single();

      if (findError || !company) {
        console.error('Company not found:', company_name);
        return new Response(
          JSON.stringify({ success: false, error: 'Company not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateData: Record<string, unknown> = {};
      if (org_number) updateData.org_number = org_number;
      if (billing_email || email || admin_email) updateData.billing_email = billing_email || email || admin_email;

      const { error: updateError } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', company.id);

      if (updateError) {
        console.error('Error updating company:', updateError);
        throw updateError;
      }

      console.log('Company updated:', company_name);

      return new Response(
        JSON.stringify({ success: true, message: 'Company updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'update_package') {
      // Update company package/subscription from AdminHub
      let query = supabase.from('companies').update({ 
        subscription_plan: package_name || 'free'
      });
      
      if (org_number) {
        query = query.or(`org_number.eq.${org_number},name.eq.${company_name}`);
      } else {
        query = query.eq('name', company_name);
      }

      const { data, error } = await query.select().maybeSingle();

      if (error) {
        console.error('Error updating package:', error);
        throw error;
      }

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Company not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Company package updated:', data.name, 'to', package_name);

      return new Response(
        JSON.stringify({ success: true, company: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'delete') {
      // Delete company (if no users)
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('name', company_name)
        .single();

      if (!company) {
        return new Response(
          JSON.stringify({ success: false, error: 'Company not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for users
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id);

      if (count && count > 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cannot delete company with users' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: deleteError } = await supabase
        .from('companies')
        .delete()
        .eq('id', company.id);

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ success: true, message: 'Company deleted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'deactivate') {
      // Deactivate company
      let query = supabase.from('companies').update({ is_active: false });
      
      if (org_number) {
        query = query.or(`org_number.eq.${org_number},name.eq.${company_name}`);
      } else {
        query = query.eq('name', company_name);
      }

      const { data, error } = await query.select().maybeSingle();

      if (error) {
        console.error('Error deactivating company:', error);
        throw error;
      }

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Company not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Company deactivated:', data.name);

      return new Response(
        JSON.stringify({ success: true, company: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'activate') {
      // Reactivate company
      let query = supabase.from('companies').update({ is_active: true });
      
      if (org_number) {
        query = query.or(`org_number.eq.${org_number},name.eq.${company_name}`);
      } else {
        query = query.eq('name', company_name);
      }

      const { data, error } = await query.select().maybeSingle();

      if (error) throw error;

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Company not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Company activated:', data.name);

      return new Response(
        JSON.stringify({ success: true, company: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'add_admin') {
      // Add admin user to existing company
      if (!admin_email) {
        return new Response(
          JSON.stringify({ success: false, error: 'admin_email is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find company
      let query = supabase.from('companies').select('id, name');
      if (org_number) {
        query = query.or(`org_number.eq.${org_number},name.eq.${company_name}`);
      } else {
        query = query.eq('name', company_name);
      }

      const { data: company, error: findError } = await query.maybeSingle();

      if (findError || !company) {
        return new Response(
          JSON.stringify({ success: false, error: 'Company not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Adding admin to company:', company.name, 'email:', admin_email);

      let adminUserId: string | null = null;

      // First check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === admin_email);

      if (existingUser) {
        console.log('User already exists, linking to company:', existingUser.id);
        adminUserId = existingUser.id;

        // Check if profile exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', adminUserId)
          .maybeSingle();

        if (!existingProfile) {
          // Create profile
          const { error: createProfileError } = await supabase
            .from('profiles')
            .insert({
              id: adminUserId,
              full_name: admin_email.split('@')[0],
              company_id: company.id,
              email: admin_email
            });

          if (createProfileError) {
            console.error('Error creating profile:', createProfileError);
          } else {
            console.log('Profile created for existing user');
          }
        } else {
          // Update existing profile
          const { error: updateProfileError } = await supabase
            .from('profiles')
            .update({ 
              company_id: company.id,
              email: admin_email 
            })
            .eq('id', adminUserId);

          if (updateProfileError) {
            console.error('Error updating profile:', updateProfileError);
          }
        }

        // Check if user_role exists
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', adminUserId)
          .maybeSingle();

        if (!existingRole) {
          // Create admin role
          const { error: createRoleError } = await supabase
            .from('user_roles')
            .insert({ user_id: adminUserId, role: 'admin' });

          if (createRoleError) {
            console.error('Error creating admin role:', createRoleError);
          }
        } else {
          // Update to admin role
          const { error: updateRoleError } = await supabase
            .from('user_roles')
            .update({ role: 'admin' })
            .eq('user_id', adminUserId);

          if (updateRoleError) {
            console.error('Error updating admin role:', updateRoleError);
          }
        }

        console.log('Existing user linked to company as admin:', adminUserId);

      } else {
        // Generate a random password
        const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + '!';
        
        // Create user in auth.users
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: admin_email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: admin_email.split('@')[0],
            company_id: company.id
          }
        });

        if (authError) {
          console.error('Error creating admin user:', authError);
          return new Response(
            JSON.stringify({ success: false, error: authError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        adminUserId = authData.user.id;
        console.log('Admin user created:', adminUserId);

        // Update profile with company_id (trigger should have created it)
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            company_id: company.id,
            email: admin_email 
          })
          .eq('id', adminUserId);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }

        // Assign admin role
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: 'admin' })
          .eq('user_id', adminUserId);

        if (roleError) {
          console.error('Error assigning admin role:', roleError);
        } else {
          console.log('Admin role assigned to user:', adminUserId);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          admin_user_id: adminUserId,
          company_id: company.id,
          message: 'Admin user created and assigned to company'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'set_password') {
      // Set password for a user (used when syncing from AdminHub)
      if (!admin_email) {
        return new Response(
          JSON.stringify({ success: false, error: 'admin_email is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { password } = body;
      if (!password) {
        return new Response(
          JSON.stringify({ success: false, error: 'password is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find user by email
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === admin_email);

      if (!existingUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Setting password for user:', admin_email);

      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: password }
      );

      if (updateError) {
        console.error('Error setting password:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Password set successfully for:', admin_email);

      return new Response(
        JSON.stringify({ success: true, message: 'Password set successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
