// Simple local storage authentication
// NOT SECURE for real production apps with sensitive data, 
// but sufficient for personal/local use as requested.

const STORAGE_KEY = 'aca_auth_session';
const PASSWORD_KEY = 'aca_auth_password';
const DEFAULT_USER = 'admin';
const DEFAULT_PASS = 'admin';

export interface User {
  username: string;
}

export const auth = {
  // Check if currently authenticated
  isAuthenticated(): boolean {
    const session = localStorage.getItem(STORAGE_KEY);
    return session === 'true';
  },

  // Login with password
  login(password: string): boolean {
    const storedPass = localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASS;
    
    if (password === storedPass) {
      localStorage.setItem(STORAGE_KEY, 'true');
      return true;
    }
    return false;
  },

  // Logout
  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  // Change password
  changePassword(newPassword: string): void {
    localStorage.setItem(PASSWORD_KEY, newPassword);
  },

  // Get current username (always admin for this simple version)
  getUser(): User | null {
    if (this.isAuthenticated()) {
      return { username: DEFAULT_USER };
    }
    return null;
  }
};
