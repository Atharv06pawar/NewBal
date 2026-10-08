import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Default Supabase configuration (Live free-tier project for NEWBAL cloud sync)
const DEFAULT_SUPABASE_URL = 'https://nrsqfnblceubfhppqots.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yc3FmbmJsY2V1YmZocHBxb3RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MzgxMjMsImV4cCI6MjEwNzAxNDEyM30.TT76mjBFmqjqYMjuROz6MrGXuhGO5uFMLHZ8Y3SE5KU';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder')
);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface AuthUserProfile {
  id: string;
  email: string;
  fullName: string;
  businessName: string;
  avatarUrl?: string;
  isCloudSynced: boolean;
  provider: 'supabase' | 'local';
}

/**
 * Standard Web Crypto SHA-256 hash helper
 */
export async function computeHash(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Deterministic account ID derived from email
 * Guarantees every device logged into the same email addresses the exact same cloud sync row.
 */
export async function getAccountIdForEmail(email: string): Promise<string> {
  const clean = email.toLowerCase().trim();
  const hash = await computeHash(clean);
  return `usr_${hash.slice(0, 20)}`;
}

/**
 * Authentication service supporting Supabase Cloud Auth, Multi-Device Cloud Verification,
 * and seamless offline fallback.
 */
export class AuthService {
  /**
   * Get currently active session and user profile
   */
  static async getCurrentUser(): Promise<AuthUserProfile | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && session.user.email) {
        const accountId = await getAccountIdForEmail(session.user.email);
        return {
          id: accountId,
          email: session.user.email,
          fullName: session.user.user_metadata?.full_name || session.user.email.split('@')[0] || 'User',
          businessName: session.user.user_metadata?.business_name || 'My Enterprise',
          avatarUrl: session.user.user_metadata?.avatar_url,
          isCloudSynced: true,
          provider: 'supabase',
        };
      }
    } catch (err) {
      console.warn('Error reading Supabase session:', err);
    }

    // Check locally stored session
    const local = localStorage.getItem('newbal_auth_user');
    if (local) {
      try {
        const parsed: AuthUserProfile = JSON.parse(local);
        if (parsed?.email) {
          // Ensure deterministic account ID for reliable multi-device sync
          const accountId = await getAccountIdForEmail(parsed.email);
          parsed.id = accountId;
          parsed.isCloudSynced = true;
          parsed.provider = 'supabase';
          localStorage.setItem('newbal_auth_user', JSON.stringify(parsed));
          return parsed;
        }
      } catch (e) {}
    }

    return null;
  }

  /**
   * Sign In with Google via Supabase OAuth
   */
  static async signInWithGoogle(): Promise<{ error?: string }> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) return { error: error.message };
      return {};
    } catch (err: any) {
      return { error: err.message || 'OAuth initialization failed' };
    }
  }

  /**
   * Sign In with Email & Password
   * Rigorous credential validation across cloud and offline cache. Never allows wrong passwords.
   */
  static async signInWithEmail(email: string, password: string): Promise<{ user?: AuthUserProfile; error?: string }> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !password) {
      return { error: 'Please enter both email and password.' };
    }

    const passwordHash = await computeHash(`newbal_salt_${password}`);
    const accountId = await getAccountIdForEmail(cleanEmail);

    if (navigator.onLine) {
      try {
        // 1. First, check if Supabase Auth credentials match directly
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (authData?.user) {
          const profile: AuthUserProfile = {
            id: accountId,
            email: cleanEmail,
            fullName: authData.user.user_metadata?.full_name || cleanEmail.split('@')[0],
            businessName: authData.user.user_metadata?.business_name || 'My Enterprise',
            isCloudSynced: true,
            provider: 'supabase',
          };
          localStorage.setItem('newbal_auth_user', JSON.stringify(profile));
          this.saveLocalUser(profile, passwordHash);
          return { user: profile };
        }

        // 2. Query user_sync_data to check registered cloud account
        const { data: syncRow } = await supabase
          .from('user_sync_data')
          .select('user_id, email, data')
          .eq('user_id', accountId)
          .maybeSingle();

        if (syncRow && syncRow.data?.account) {
          const storedAccount = syncRow.data.account;
          if (storedAccount.passwordHash) {
            if (storedAccount.passwordHash !== passwordHash) {
              return { error: 'Invalid password. Please check your credentials.' };
            }

            const profile: AuthUserProfile = {
              id: accountId,
              email: cleanEmail,
              fullName: storedAccount.fullName || cleanEmail.split('@')[0],
              businessName: storedAccount.businessName || 'My Enterprise',
              isCloudSynced: true,
              provider: 'supabase',
            };
            localStorage.setItem('newbal_auth_user', JSON.stringify(profile));
            this.saveLocalUser(profile, passwordHash);
            return { user: profile };
          }
        }

        // 3. Fallback: Check if Supabase Auth reported an error other than email not confirmed
        if (authErr) {
          if (authErr.message?.toLowerCase().includes('email not confirmed')) {
            // Check if local cache has this user's password
            const localMatched = this.findLocalUser(cleanEmail, passwordHash);
            if (localMatched) {
              localStorage.setItem('newbal_auth_user', JSON.stringify(localMatched));
              return { user: localMatched };
            }
            return { error: 'Email confirmation pending or invalid password.' };
          }
          return { error: 'Invalid email or password.' };
        }

        return { error: 'Account not found. Please click Sign Up to register your business.' };
      } catch (err: any) {
        console.warn('Cloud sign in check failed, trying offline cache:', err);
      }
    }

    // Offline authentication fallback (ONLY for previously verified users on this device)
    const localMatched = this.findLocalUser(cleanEmail, passwordHash);
    if (!localMatched) {
      return { error: 'Invalid email or password. (Offline mode)' };
    }

    localStorage.setItem('newbal_auth_user', JSON.stringify(localMatched));
    return { user: localMatched };
  }

  /**
   * Register new user with Email, Password & Business Name
   */
  static async signUp(
    email: string,
    password: string,
    fullName: string,
    businessName: string
  ): Promise<{ user?: AuthUserProfile; error?: string }> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !password || !fullName || !businessName) {
      return { error: 'Please fill in all registration fields.' };
    }
    if (password.length < 6) {
      return { error: 'Password must be at least 6 characters long.' };
    }

    const passwordHash = await computeHash(`newbal_salt_${password}`);
    const accountId = await getAccountIdForEmail(cleanEmail);

    const profile: AuthUserProfile = {
      id: accountId,
      email: cleanEmail,
      fullName: fullName.trim(),
      businessName: businessName.trim(),
      isCloudSynced: true,
      provider: 'supabase',
    };

    if (navigator.onLine) {
      try {
        // Check if an account already exists in user_sync_data
        const { data: existingRow } = await supabase
          .from('user_sync_data')
          .select('user_id, data')
          .eq('user_id', accountId)
          .maybeSingle();

        if (existingRow?.data?.account) {
          return { error: 'An account with this email already exists. Please sign in.' };
        }

        // Attempt Supabase Auth sign up
        try {
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: { full_name: fullName.trim(), business_name: businessName.trim() },
            },
          });
        } catch (e) {
          // Non-blocking if email signup has SMTP limits
        }

        // Save account securely into user_sync_data
        const accountPayload = {
          id: accountId,
          email: cleanEmail,
          fullName: fullName.trim(),
          businessName: businessName.trim(),
          passwordHash,
          createdAt: new Date().toISOString(),
        };

        const initialData = existingRow?.data || {};
        initialData.account = accountPayload;
        initialData.updatedAt = new Date().toISOString();

        await supabase.from('user_sync_data').upsert(
          {
            user_id: accountId,
            email: cleanEmail,
            data: initialData,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      } catch (err: any) {
        console.warn('Cloud registration sync note:', err);
      }
    }

    // Persist locally
    localStorage.setItem('newbal_auth_user', JSON.stringify(profile));
    this.saveLocalUser(profile, passwordHash);
    return { user: profile };
  }

  /**
   * Helper to verify cached local user
   */
  private static findLocalUser(cleanEmail: string, passwordHash: string): AuthUserProfile | null {
    try {
      const saved = JSON.parse(localStorage.getItem('newbal_registered_users') || '[]');
      const user = saved.find(
        (u: any) =>
          u.email?.toLowerCase() === cleanEmail &&
          (u.passwordHash === passwordHash || u.password === passwordHash)
      );
      if (user) {
        return {
          id: user.id,
          email: user.email,
          fullName: user.fullName || cleanEmail.split('@')[0],
          businessName: user.businessName || 'My Enterprise',
          isCloudSynced: false,
          provider: 'local',
        };
      }
    } catch (e) {}
    return null;
  }

  /**
   * Helper to store local user credentials
   */
  private static saveLocalUser(profile: AuthUserProfile, passwordHash: string) {
    try {
      const saved = JSON.parse(localStorage.getItem('newbal_registered_users') || '[]');
      const index = saved.findIndex((u: any) => u.email?.toLowerCase() === profile.email.toLowerCase());
      const record = { ...profile, passwordHash };
      if (index >= 0) {
        saved[index] = record;
      } else {
        saved.push(record);
      }
      localStorage.setItem('newbal_registered_users', JSON.stringify(saved));
    } catch (e) {}
  }

  /**
   * Sign Out
   */
  static async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    localStorage.removeItem('newbal_auth_user');
  }
}
