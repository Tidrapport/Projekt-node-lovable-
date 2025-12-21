-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for app roles
CREATE TYPE app_role AS ENUM ('admin', 'user');

-- Create enum for shift types
CREATE TYPE shift_type AS ENUM ('day', 'evening', 'night', 'weekend');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Create job_roles table
CREATE TABLE public.job_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Insert default job roles
INSERT INTO public.job_roles (name, description) VALUES
  ('Termitsvetsare', 'Termitsvetsning av skarvar'),
  ('Bantekniker', 'Underhåll och reparation av spår'),
  ('Maskinförare', 'Drift av arbetsmaskiner'),
  ('Anläggare', 'Allmänt anläggningsarbete'),
  ('Hantlangare', 'Assistans och stödarbete');

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES public.profiles(id)
);

-- Create subprojects table
CREATE TABLE public.subprojects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create shift_types_config table for shift multipliers
CREATE TABLE public.shift_types_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_type shift_type UNIQUE NOT NULL,
  multiplier DECIMAL(3,2) DEFAULT 1.00 NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Insert default shift types with multipliers
INSERT INTO public.shift_types_config (shift_type, multiplier, description) VALUES
  ('day', 1.00, 'Dagarbete (06:00-18:00)'),
  ('evening', 1.25, 'Kvällsarbete (18:00-22:00)'),
  ('night', 1.50, 'Nattarbete (22:00-06:00)'),
  ('weekend', 1.50, 'Helgarbete');

-- Create time_entries table
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  project_id UUID REFERENCES public.projects(id) NOT NULL,
  subproject_id UUID REFERENCES public.subprojects(id),
  job_role_id UUID REFERENCES public.job_roles(id) NOT NULL,
  shift_type shift_type NOT NULL DEFAULT 'day',
  work_description TEXT,
  total_hours DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create material_types table
CREATE TABLE public.material_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Insert default material types
INSERT INTO public.material_types (name, unit, description) VALUES
  ('Bensin', 'liter', 'Drivmedel för maskiner'),
  ('2-takt', 'liter', 'Tvåtaktsolja'),
  ('Kapskivor', 'st', 'Kapskivor för vinkelslip'),
  ('Slipskivor', 'st', 'Slipskivor för vinkelslip'),
  ('Termitportioner', 'st', 'Termitportioner för svetsning');

-- Create material_reports table
CREATE TABLE public.material_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE CASCADE NOT NULL,
  material_type_id UUID REFERENCES public.material_types(id) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create deviation_reports table
CREATE TABLE public.deviation_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create deviation_images table for storing image references
CREATE TABLE public.deviation_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deviation_report_id UUID REFERENCES public.deviation_reports(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subprojects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_types_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deviation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deviation_images ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for job_roles (read-only for users, manageable by admins)
CREATE POLICY "Everyone can view active job roles"
  ON public.job_roles FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage job roles"
  ON public.job_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for projects
CREATE POLICY "Everyone can view active projects"
  ON public.projects FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage projects"
  ON public.projects FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for subprojects
CREATE POLICY "Everyone can view active subprojects"
  ON public.subprojects FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage subprojects"
  ON public.subprojects FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for shift_types_config
CREATE POLICY "Everyone can view shift types"
  ON public.shift_types_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage shift types"
  ON public.shift_types_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for time_entries
CREATE POLICY "Users can view their own time entries"
  ON public.time_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own time entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time entries"
  ON public.time_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all time entries"
  ON public.time_entries FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all time entries"
  ON public.time_entries FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for material_types
CREATE POLICY "Everyone can view active material types"
  ON public.material_types FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage material types"
  ON public.material_types FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for material_reports
CREATE POLICY "Users can view their own material reports"
  ON public.material_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.time_entries
      WHERE time_entries.id = material_reports.time_entry_id
      AND time_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create material reports for their time entries"
  ON public.material_reports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.time_entries
      WHERE time_entries.id = material_reports.time_entry_id
      AND time_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all material reports"
  ON public.material_reports FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all material reports"
  ON public.material_reports FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for deviation_reports
CREATE POLICY "Users can view their own deviation reports"
  ON public.deviation_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deviation reports"
  ON public.deviation_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deviation reports"
  ON public.deviation_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all deviation reports"
  ON public.deviation_reports FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all deviation reports"
  ON public.deviation_reports FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for deviation_images
CREATE POLICY "Users can view images for their deviation reports"
  ON public.deviation_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deviation_reports
      WHERE deviation_reports.id = deviation_images.deviation_report_id
      AND deviation_reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload images for their deviation reports"
  ON public.deviation_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deviation_reports
      WHERE deviation_reports.id = deviation_images.deviation_report_id
      AND deviation_reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all deviation images"
  ON public.deviation_images FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all deviation images"
  ON public.deviation_images FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subprojects_updated_at
  BEFORE UPDATE ON public.subprojects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deviation_reports_updated_at
  BEFORE UPDATE ON public.deviation_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for deviation images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('deviation-images', 'deviation-images', false)
ON CONFLICT DO NOTHING;

-- Storage policies for deviation images
CREATE POLICY "Users can upload deviation images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'deviation-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own deviation images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'deviation-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all deviation images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'deviation-images' AND
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage all deviation images"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'deviation-images' AND
    public.has_role(auth.uid(), 'admin')
  );