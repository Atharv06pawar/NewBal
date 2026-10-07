import { createClient, type SupabaseClient, type User, type Session } from '@supabase/supabase-js';

// Read environment variables (from Vite .env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('placeholder')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

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
 * Authentication service supporting Supabase Google OAuth, Email/Password,
 * and seamless local fallback when offline or before cloud credentials are provided.
 */
export class AuthService {
  /**
   * Get currently active session and user profile
   */
  static async getCurrentUser(): Promise<AuthUserProfile | null> {
    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          return {
            id: session.user.id,
            email: session.user.email || '',
            fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            businessName: session.user.user_metadata?.business_name || 'My Enterprise',
            avatarUrl: session.user.user_metadata?.avatar_url,
            isCloudSynced: true,
            provider: 'supabase',
          };
        }
      } catch (err) {
        console.warn('Error fetching Supabase session, falling back to local session', err);
      }
    }

    // Check locally stored session
    const local = localStorage.getItem('newbal_auth_user');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {}
    }

    return null;
  }

  /**
   * Sign In with Google via Supabase OAuth
   */
  static async signInWithGoogle(): Promise<{ error?: string }> {
    if (!supabase) {
      return { error: 'Supabase credentials not configured in .env. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
    }

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
   */
  static async signInWithEmail(email: string, password: string): Promise<{ user?: AuthUserProfile; error?: string }> {
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        if (data.user) {
          const profile: AuthUserProfile = {
            id: data.user.id,
            email: data.user.email || email,
            fullName: data.user.user_metadata?.full_name || email.split('@')[0],
            businessName: data.user.user_metadata?.business_name || 'My Enterprise',
            isCloudSynced: true,
            provider: 'supabase',
          };
          localStorage.setItem('newbal_auth_user', JSON.stringify(profile));
          return { user: profile };
        }
      } catch (err: any) {
        return { error: err.message };
      }
    }

    // Local authentication fallback
    const savedUsers = JSON.parse(localStorage.getItem('newbal_registered_users') || '[]');
    const matched = savedUsers.find((u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!matched && savedUsers.length > 0) {
      return { error: 'Invalid email or password' };
    }

    const profile: AuthUserProfile = {
      id: matched?.id || `user-loc-${Date.now()}`,
      email,
      fullName: matched?.fullName || email.split('@')[0],
      businessName: matched?.businessName || 'My Enterprise',
      isCloudSynced: false,
      provider: 'local',
    };
    localStorage.setItem('newbal_auth_user', JSON.stringify(profile));
    return { user: profile };
  }

  /**
   * Register new user with Email, Password & Business Name
   */
  static async signUp(email: string, password: string, fullName: string, businessName: string): Promise<{ user?: AuthUserProfile; error?: string }> {
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, business_name: businessName },
          },
        });
        if (error) return { error: error.message };
        if (data.user) {
          const profile: AuthUserProfile = {
            id: data.user.id,
            email: data.user.email || email,
            fullName,
            businessName,
            isCloudSynced: true,
            provider: 'supabase',
          };
          localStorage.setItem('newbal_auth_user', JSON.stringify(profile));
          return { user: profile };
        }
      } catch (err: any) {
        return { error: err.message };
      }
    }

    // Local fallback registration
    const savedUsers = JSON.parse(localStorage.getItem('newbal_registered_users') || '[]');
    const profile: AuthUserProfile = {
      id: `user-loc-${Date.now()}`,
      email,
      fullName,
      businessName,
      isCloudSynced: false,
      provider: 'local',
    };
    savedUsers.push({ ...profile, password });
    localStorage.setItem('newbal_registered_users', JSON.stringify(savedUsers));
    localStorage.setItem('newbal_auth_user', JSON.stringify(profile));
    return { user: profile };
  }

  /**
   * Sign Out
   */
  static async signOut(): Promise<void> {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {}
    }
    localStorage.removeItem('newbal_auth_user');
  }
}
