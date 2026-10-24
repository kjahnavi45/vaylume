-- ============================================================
-- VAYLUME — Supabase PostgreSQL Production Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────────────────────
-- 1. user_preferences
--    Stores per-user theme, accent, custom wallpaper & vault settings
--    Linked to Supabase Auth via auth.users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    preferred_language      TEXT        NOT NULL DEFAULT 'English',
    theme                   TEXT        NOT NULL DEFAULT 'dark',       -- 'dark', 'light', 'preset'
    preset_theme            TEXT        NOT NULL DEFAULT 'cyan',       -- 'cyan', 'purple', 'emerald', 'amber', 'minimal'
    custom_accent           TEXT        NOT NULL DEFAULT '#00f2fe',
    wallpaper_url           TEXT,                                      -- Custom background image URL / data
    wallpaper_blur          INT         NOT NULL DEFAULT 0,            -- 0 to 25px
    wallpaper_brightness    INT         NOT NULL DEFAULT 100,          -- 20 to 120%
    wallpaper_overlay_opacity INT       NOT NULL DEFAULT 40,           -- 0 to 90%
    auto_lock_minutes       INT         NOT NULL DEFAULT 5,            -- 0 = disabled, 1, 5, 15, 30 min
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure backwards-compatibility for existing deployments
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS preset_theme TEXT DEFAULT 'cyan';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS custom_accent TEXT DEFAULT '#00f2fe';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS wallpaper_url TEXT;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS wallpaper_blur INT DEFAULT 0;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS wallpaper_brightness INT DEFAULT 100;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS wallpaper_overlay_opacity INT DEFAULT 40;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS auto_lock_minutes INT DEFAULT 5;

CREATE INDEX IF NOT EXISTS user_preferences_user_idx ON public.user_preferences (user_id);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own preferences"
    ON public.user_preferences
    FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- 2. memories
--    Photo memories with title, description, date, category, and tags
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.memories (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    description     TEXT        CHECK (char_length(description) <= 2000),
    memory_date     DATE,
    category        TEXT        DEFAULT 'Personal',
    tags            JSONB       DEFAULT '[]',
    photo_path      TEXT,                       -- Private storage path (never a public URL)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Personal';
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS memories_user_id_idx ON public.memories (user_id);
CREATE INDEX IF NOT EXISTS memories_created_at_idx ON public.memories (created_at DESC);
CREATE INDEX IF NOT EXISTS memories_category_idx ON public.memories (user_id, category);

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own memories"
    ON public.memories
    FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- 3. vault_security
--    Two-Step Lock credentials (WebAuthn Passkey + 3x3 Pattern + PIN)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vault_security (
    user_id                 UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    pattern_hash            TEXT        NOT NULL,
    webauthn_credential_id  TEXT,
    webauthn_public_key     TEXT,
    has_webauthn            BOOLEAN     NOT NULL DEFAULT false,
    fallback_pin_hash       TEXT,
    is_setup_complete       BOOLEAN     NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vault_security_user_idx ON public.vault_security (user_id);

ALTER TABLE public.vault_security ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own vault security"
    ON public.vault_security
    FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- 4. notes
--    AI-generated and user study notes (Cloud Persistence)
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
    tags            JSONB       DEFAULT '[]',
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS notes_user_id_idx ON public.notes (user_id);
CREATE INDEX IF NOT EXISTS notes_created_at_idx ON public.notes (created_at DESC);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notes"
    ON public.notes
    FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- 5. documents (Digital Locker)
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
-- 6. conversations (Private 1-on-1 User-to-User Chat)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user2_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status          TEXT        NOT NULL DEFAULT 'accepted', -- 'accepted', 'pending', 'blocked'
    last_message    TEXT,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_conversation_pair UNIQUE (user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS conversations_user1_idx ON public.conversations (user1_id);
CREATE INDEX IF NOT EXISTS conversations_user2_idx ON public.conversations (user2_id);
CREATE INDEX IF NOT EXISTS conversations_updated_idx ON public.conversations (last_message_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own conversations"
    ON public.conversations
    FOR ALL
    USING  (auth.uid() = user1_id OR auth.uid() = user2_id)
    WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);


-- ─────────────────────────────────────────────────────────────
-- 7. messages (Chat Messages with Delivery Status)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content         TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
    status          TEXT        NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'read'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conv_idx ON public.messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS messages_recipient_idx ON public.messages (recipient_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations"
    ON public.messages
    FOR ALL
    USING  (auth.uid() = sender_id OR auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = sender_id);


-- ─────────────────────────────────────────────────────────────
-- 8. user_blocks (Block & Report Enforcement)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_blocks (
    blocker_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their blocked list"
    ON public.user_blocks
    FOR ALL
    USING  (auth.uid() = blocker_id)
    WITH CHECK (auth.uid() = blocker_id);


-- ─────────────────────────────────────────────────────────────
-- 9. Storage buckets (Supabase Dashboard → Storage)
-- ─────────────────────────────────────────────────────────────
-- Create these buckets in Supabase Storage and set them to PRIVATE:
--
--   Bucket name: memories     (for memory photos)
--   Bucket name: locker       (for locker documents)
--   Bucket name: wallpapers   (for custom user wallpapers)
--
-- Storage RLS policies — example for 'memories' bucket:
--   INSERT: ((storage.foldername(name))[1] = auth.uid()::text)
--   SELECT / DELETE: ((storage.foldername(name))[1] = auth.uid()::text)
-- ─────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- 10. Triggers: auto-update updated_at columns
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

CREATE TRIGGER vault_security_updated_at
    BEFORE UPDATE ON public.vault_security
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER notes_updated_at
    BEFORE UPDATE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
