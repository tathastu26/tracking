-- ============================================================================
-- COMPLETE SUPABASE DATABASE SETUP FOR OPERATIONS DASHBOARD
-- ============================================================================
-- Copy and paste ALL of this SQL into your Supabase dashboard SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. CREATE PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    location TEXT,
    passport_document TEXT,
    other_documents TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 2. CREATE NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'error', 'success')),
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS) ON PROFILES TABLE
-- ============================================================================
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. CREATE RLS POLICIES FOR PROFILES TABLE
-- ============================================================================

-- Policy: Users can SELECT (view) their own profile
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Policy: Users can UPDATE their own profile
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy: Users can INSERT their own profile
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY (RLS) ON NOTIFICATIONS TABLE
-- ============================================================================
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. CREATE RLS POLICIES FOR NOTIFICATIONS TABLE
-- ============================================================================

-- Policy: Users can SELECT (view) their own notifications
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can UPDATE their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 7. ENABLE ROW LEVEL SECURITY (RLS) ON STORAGE.OBJECTS
-- ============================================================================
-- Note: Storage bucket "documents" must be created via Supabase Dashboard
-- Go to: Storage > New Bucket > Name: "documents" > Privacy: Private
-- Then run these policies:

ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. CREATE RLS POLICIES FOR STORAGE OBJECTS
-- ============================================================================

-- Policy: Users can INSERT (upload) to their folder
CREATE POLICY "Users can upload their own documents"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'documents' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy: Users can SELECT (view) their own documents
CREATE POLICY "Users can view their own documents"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'documents' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy: Users can UPDATE their own documents
CREATE POLICY "Users can update their own documents"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'documents' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'documents' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy: Users can DELETE their own documents
CREATE POLICY "Users can delete their own documents"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'documents' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- ============================================================================
-- 9. CREATE INDEXES FOR BETTER QUERY PERFORMANCE
-- ============================================================================

-- Index on user_id in notifications for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
    ON public.notifications(user_id);

-- Index on created_at in notifications for sorting
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
    ON public.notifications(created_at DESC);

-- Index on read status in notifications
CREATE INDEX IF NOT EXISTS idx_notifications_read 
    ON public.notifications(read);

-- ============================================================================
-- 10. CREATE VIEWS (OPTIONAL - For advanced queries)
-- ============================================================================

-- View: User notifications count
CREATE OR REPLACE VIEW public.user_notifications_count AS
SELECT 
    user_id,
    COUNT(*) AS total_notifications,
    COUNT(CASE WHEN read = FALSE THEN 1 END) AS unread_notifications
FROM public.notifications
GROUP BY user_id;

-- ============================================================================
-- 11. SAMPLE DATA (OPTIONAL - For testing)
-- ============================================================================
-- Uncomment and run if you want to add sample data:

-- INSERT INTO public.notifications (user_id, title, message, type, read)
-- VALUES 
--   ((SELECT id FROM auth.users LIMIT 1), 'Welcome', 'Welcome to Operations Dashboard!', 'success', FALSE),
--   ((SELECT id FROM auth.users LIMIT 1), 'Profile Update', 'Your profile has been successfully updated', 'info', FALSE),
--   ((SELECT id FROM auth.users LIMIT 1), 'Document Uploaded', 'Your passport document has been uploaded', 'success', TRUE);

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
-- Next steps:
-- 1. Create a "documents" storage bucket (Private) in Supabase Dashboard
-- 2. Test by signing up and logging in
-- 3. Upload a passport document in the profile page
-- ============================================================================
