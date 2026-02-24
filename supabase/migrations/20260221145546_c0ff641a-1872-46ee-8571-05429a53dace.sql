
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email, COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Boards table
CREATE TABLE public.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Board',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- Board members table (must be created BEFORE helper function that references it)
CREATE TABLE public.board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(board_id, user_id)
);
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

-- Board objects table
CREATE TABLE public.board_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  objects JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.board_objects ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_board_owner(_board_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.boards WHERE id = _board_id AND owner_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_board_member(_board_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.board_members WHERE board_id = _board_id AND user_id = auth.uid());
$$;

-- RLS for boards
CREATE POLICY "Users can view own boards" ON public.boards FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.is_board_member(id));
CREATE POLICY "Users can create boards" ON public.boards FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can update boards" ON public.boards FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owners can delete boards" ON public.boards FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- RLS for board_members
CREATE POLICY "View board members" ON public.board_members FOR SELECT TO authenticated USING (public.is_board_owner(board_id) OR user_id = auth.uid());
CREATE POLICY "Owner can add members" ON public.board_members FOR INSERT TO authenticated WITH CHECK (public.is_board_owner(board_id));
CREATE POLICY "Owner can remove members" ON public.board_members FOR DELETE TO authenticated USING (public.is_board_owner(board_id));

-- RLS for board_objects
CREATE POLICY "Can view board objects" ON public.board_objects FOR SELECT TO authenticated USING (public.is_board_owner(board_id) OR public.is_board_member(board_id));
CREATE POLICY "Can insert board objects" ON public.board_objects FOR INSERT TO authenticated WITH CHECK (public.is_board_owner(board_id) OR public.is_board_member(board_id));
CREATE POLICY "Can update board objects" ON public.board_objects FOR UPDATE TO authenticated USING (public.is_board_owner(board_id) OR public.is_board_member(board_id));
CREATE POLICY "Owner can delete board objects" ON public.board_objects FOR DELETE TO authenticated USING (public.is_board_owner(board_id));

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER update_boards_updated_at BEFORE UPDATE ON public.boards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_board_objects_updated_at BEFORE UPDATE ON public.board_objects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_objects;
