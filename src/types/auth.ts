export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
  emailVerification?: boolean;
  role?: 'founder' | 'admin' | 'contributor' | 'employee' | 'observer';
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
