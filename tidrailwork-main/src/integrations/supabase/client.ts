// Temporary stub to avoid import errors after removing Supabase.
// Frontend should use the Node backend via `apiFetch` instead.
// We return empty data so the UI can render while we migrate calls.
const empty = { data: [], error: null };
const emptySingle = { data: null, error: null };

export const supabase = {
  from() {
    const chainable: any = {};
    chainable.select = async () => empty;
    chainable.insert = async () => empty;
    chainable.update = async () => empty;
    chainable.delete = async () => empty;
    chainable.eq = () => chainable;
    chainable.order = () => chainable;
    chainable.limit = () => chainable;
    chainable.gte = () => chainable;
    chainable.lte = () => chainable;
    chainable.is = () => chainable;
    chainable.maybeSingle = async () => emptySingle;
    chainable.single = async () => emptySingle;
    return chainable;
  },
  auth: {
    signUp: async () => emptySingle,
    signInWithPassword: async () => emptySingle,
    signOut: async () => emptySingle,
    getUser: async () => emptySingle,
  },
  storage: {
    from: () => ({
      upload: async () => emptySingle,
      getPublicUrl: () => ({ data: null, error: null }),
      remove: async () => emptySingle,
    }),
  },
} as const;
