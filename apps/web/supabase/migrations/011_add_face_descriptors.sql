-- Add face descriptor column to partner_photos table
ALTER TABLE public.partner_photos
ADD COLUMN IF NOT EXISTS face_descriptor JSONB;

-- Add index for efficient similarity searches (using GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_partner_photos_face_descriptor 
ON public.partner_photos USING GIN (face_descriptor);

-- Add column to track if face detection was attempted
ALTER TABLE public.partner_photos
ADD COLUMN IF NOT EXISTS face_detection_attempted BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.partner_photos.face_descriptor IS 
'128-dimensional face descriptor vector from face-api.js. Stored as JSON array of numbers.';

COMMENT ON COLUMN public.partner_photos.face_detection_attempted IS 
'Whether face detection was attempted on this photo. False if no face found or detection failed.';
