-- Create profiles table
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  is_pro boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read and update their own profiles
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- Function to handle new user creation automatically via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Create encrypted_folders table
CREATE TABLE public.encrypted_folders (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  updated_at timestamptz NOT NULL,
  is_deleted boolean DEFAULT false NOT NULL,
  encrypted_data text NOT NULL,
  nonce text NOT NULL
);

-- Enable RLS for encrypted_folders
ALTER TABLE public.encrypted_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own folders" 
ON public.encrypted_folders FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- Create encrypted_tasks table
CREATE TABLE public.encrypted_tasks (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  updated_at timestamptz NOT NULL,
  is_deleted boolean DEFAULT false NOT NULL,
  encrypted_data text NOT NULL,
  nonce text NOT NULL
);

-- Enable RLS for encrypted_tasks
ALTER TABLE public.encrypted_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tasks" 
ON public.encrypted_tasks FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- Create encrypted_notes table
CREATE TABLE public.encrypted_notes (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  is_deleted boolean DEFAULT false NOT NULL,
  encrypted_data text NOT NULL,
  nonce text NOT NULL
);

-- Enable RLS for encrypted_notes
ALTER TABLE public.encrypted_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notes" 
ON public.encrypted_notes FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- Create compound indexes for efficient syncing (pull queries)
CREATE INDEX idx_folders_user_updated 
  ON public.encrypted_folders (user_id, updated_at DESC);

CREATE INDEX idx_tasks_user_updated 
  ON public.encrypted_tasks (user_id, updated_at DESC);

CREATE INDEX idx_notes_user_updated 
  ON public.encrypted_notes (user_id, updated_at DESC);
