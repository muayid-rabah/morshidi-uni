import { createClient } from '@supabase/supabase-js';
import { UniversityStore, type SeedBundle } from '../store';
import { SQLiteUniversityRepository } from './sqliteUniversityRepository';
import {
  SupabaseJsUniversityDataClient,
  SupabaseUniversityRepository,
  type UniversitySupabaseDataClient,
} from './supabaseUniversityRepository';
import type { UniversityRepository } from './universityRepository';

export interface UniversityRepositoryFactoryOptions {
  env?: NodeJS.ProcessEnv;
  databasePath?: string;
  seedSyntheticData?: boolean;
  seedBundle?: SeedBundle;
  supabaseDataClient?: UniversitySupabaseDataClient;
}

export function createUniversityRepository(options: UniversityRepositoryFactoryOptions = {}): UniversityRepository {
  const env = options.env ?? process.env;
  const backend = (env.UNI_DATA_BACKEND || 'sqlite').trim().toLowerCase();

  if (backend === 'sqlite') {
    return new SQLiteUniversityRepository(new UniversityStore(
      options.databasePath ?? env.UNI_DATABASE_PATH,
      options.seedSyntheticData,
      options.seedBundle,
    ));
  }

  if (backend === 'supabase') {
    const url = env.SUPABASE_URL?.trim();
    const secretKey = env.SUPABASE_SECRET_KEY?.trim();
    if (!url) throw new Error('SUPABASE_URL is required when UNI_DATA_BACKEND=supabase.');
    if (!secretKey) throw new Error('SUPABASE_SECRET_KEY is required when UNI_DATA_BACKEND=supabase.');
    const dataClient = options.supabaseDataClient ?? new SupabaseJsUniversityDataClient(createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }));
    return new SupabaseUniversityRepository(dataClient);
  }

  throw new Error(`Unsupported UNI_DATA_BACKEND value: ${backend || '(empty)'}. Expected sqlite or supabase.`);
}
