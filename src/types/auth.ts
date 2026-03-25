export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
  role?: 'founder' | 'admin' | 'contributor' | 'employee' | 'observer';
  status?: string;
  bio?: string;
  avatar?: string;
  emailVerification?: boolean;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  is2FAVerified: boolean;
  login: (email: string, password: string) => Promise<{ requires2FA?: boolean } | undefined>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
