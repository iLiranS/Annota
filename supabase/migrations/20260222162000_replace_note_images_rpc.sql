CREATE OR REPLACE FUNCTION public.replace_note_images(
  p_note_id uuid,
  p_user_id uuid,
  p_image_ids text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to replace note images for this user';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.encrypted_notes n
    WHERE n.id = p_note_id
      AND n.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Note % not found for user %', p_note_id, p_user_id;
  END IF;

  DELETE FROM public.note_images
  WHERE note_id = p_note_id
    AND user_id = p_user_id;

  INSERT INTO public.note_images (note_id, image_id, user_id)
  SELECT
    p_note_id,
    image_id,
    p_user_id
  FROM (
    SELECT DISTINCT unnest(COALESCE(p_image_ids, ARRAY[]::text[])) AS image_id
  ) ids
  WHERE ids.image_id IS NOT NULL
    AND ids.image_id <> '';
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_note_images(uuid, uuid, text[]) TO authenticated;
