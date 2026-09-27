export interface AuthStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface AuthStoragePair {
  persistent: AuthStorage;
  session: AuthStorage;
}

export function createAuthStorageAdapter(
  stores: AuthStoragePair,
  initialRememberMe = false
): AuthStorage & { setRememberMe(value: boolean): void } {
  let rememberMe = initialRememberMe;
  return {
    async getItem(key) {
      return (await stores.persistent.getItem(key)) ?? stores.session.getItem(key);
    },
    async setItem(key, value) {
      const target = rememberMe ? stores.persistent : stores.session;
      const other = rememberMe ? stores.session : stores.persistent;
      await target.setItem(key, value);
      await other.removeItem(key);
    },
    async removeItem(key) {
      await Promise.all([
        stores.persistent.removeItem(key),
        stores.session.removeItem(key),
      ]);
    },
    setRememberMe(value) {
      rememberMe = value;
    },
  };
}

function browserStorage(name: 'localStorage' | 'sessionStorage'): AuthStorage {
  const getStorage = () => typeof window === 'undefined' ? undefined : window[name];
  return {
    getItem: (key) => getStorage()?.getItem(key) ?? null,
    setItem: (key, value) => getStorage()?.setItem(key, value),
    removeItem: (key) => getStorage()?.removeItem(key),
  };
}

export const supabaseAuthStorage = createAuthStorageAdapter({
  persistent: browserStorage('localStorage'),
  session: browserStorage('sessionStorage'),
});
