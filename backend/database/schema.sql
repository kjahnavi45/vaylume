-- ============================================================
-- VAYLUME — Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────────────────────
-- 1. user_preferences
--    Stores per-user settings (language, theme, etc.)
--    Linked to Supabase Auth via auth.users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    preferred_language  TEXT    NOT NULL DEFAULT 'English',
    theme           TEXT        NOT NULL DEFAULT 'light',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own preferences"
    ON public.user_preferences
    FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- 2. memories
--    Photo memories with title, description, and date
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.memories (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    description     TEXT        CHECK (char_length(description) <= 2000),
    memory_date     DATE,
    photo_path      TEXT,                       -- Storage path (never a public URL)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS memories_user_id_idx ON public.memories (user_id);
CREATE INDEX IF NOT EXISTS memories_created_at_idx ON public.memories (created_at DESC);

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own memories"
    ON public.memories
    FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- 3. notes
--    AI-generated study notes (optional persistence)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic           TEXT        NOT NULL,
    language        TEXT        NOT NULL DEFAULT 'English',
    difficulty      TEXT        NOT NULL DEFAULT 'Intermediate',
    format          TEXT        NOT NULL DEFAULT 'Bullets',
    title           TEXT        NOT NULL,
    explanation     TEXT        NOT NULL,
    key_points      JSONB       NOT NULL DEFAULT '[]',
    examples        JSONB       NOT NULL DEFAULT '[]',
    summary         TEXT        NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notes_user_id_idx ON public.notes (user_id);
CREATE INDEX IF NOT EXISTS notes_created_at_idx ON public.notes (created_at DESC);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notes"
    ON public.notes
    FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- 4. documents (Digital Locker)
--    Private file metadata — actual bytes live in Supabase Storage
-- ─────────────────────────────────────────────────────────────
CREATE TYPE document_category AS ENUM (
    'Identity', 'Education', 'Certificates', 'Career', 'Personal', 'Other'
);

CREATE TABLE IF NOT EXISTS public.documents (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID                NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name       TEXT                NOT NULL,           -- UUID-based safe name
    original_name   TEXT                NOT NULL,           -- Original upload filename
    category        document_category   NOT NULL DEFAULT 'Other',
    mime_type       TEXT                NOT NULL,
    size_bytes      BIGINT              NOT NULL CHECK (size_bytes > 0),
    storage_path    TEXT                NOT NULL,           -- Private storage path
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_user_id_idx ON public.documents (user_id);
CREATE INDEX IF NOT EXISTS documents_category_idx ON public.documents (user_id, category);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON public.documents (created_at DESC);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own documents"
    ON public.documents
    FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- 5. Storage buckets (run separately or via Supabase dashboard)
-- ─────────────────────────────────────────────────────────────
-- Create these buckets in Supabase Storage and set them to PRIVATE:
--
--   Bucket name: memories     (for memory photos)
--   Bucket name: locker       (for locker documents)
--
-- Storage RLS policies — example for 'memories' bucket:
--
-- INSERT policy:
--   ((storage.foldername(name))[1] = auth.uid()::text)
--
-- SELECT / DELETE policy:
--   ((storage.foldername(name))[1] = auth.uid()::text)
--
-- Apply the same pattern for the 'locker' bucket.
-- ─────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- 6. Trigger: auto-update updated_at columns
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER memories_updated_at
    BEFORE UPDATE ON public.memories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
