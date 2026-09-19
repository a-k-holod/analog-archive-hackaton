-- Derived OCR text for handwritten-note photographs.
-- Additive and nullable: the original image remains the archival source.

alter table public.notes
  add column if not exists ocr_text text;
