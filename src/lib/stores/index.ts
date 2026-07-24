import type { DataStore } from "../types";
import { LocalStore } from "./local";
import { SupabaseStore, supabaseConfigured, getSupabase } from "./supabase";

/**
 * Picks the backend. Today that's always LocalStore; the moment .env gets real
 * Supabase credentials this switches over with no other code change.
 */
export function createStore(): DataStore {
  return supabaseConfigured ? new SupabaseStore() : new LocalStore();
}

export { supabaseConfigured, getSupabase };
