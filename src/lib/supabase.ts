import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://hmprxzwdqrmthtstqvyt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtcHJ4endkcXJtdGh0c3Rxdnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDMxMzEsImV4cCI6MjA4NTIxOTEzMX0._whyjrefGPGPMgioM45Pjn-QRpRDrwgWDbajoYALaCo'
);
