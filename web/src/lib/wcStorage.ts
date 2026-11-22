/// WalletConnect 默认把会话放进 IndexedDB。弹窗和连接器各开一次时，库会在关闭连接后继续写，
/// 桌面端就会得到一块黑的二维码，复制链接也是空的。这里改用 localStorage，避开那个库。

type Store = {
  getKeys(): Promise<string[]>
  getEntries<T = unknown>(): Promise<[string, T][]>
  getItem<T = unknown>(key: string): Promise<T | undefined>
  setItem<T = unknown>(key: string, value: T): Promise<void>
  removeItem(key: string): Promise<void>
}

const PREFIX = "namepay.wc."

function memoryStore(): Store {
  const map = new Map<string, unknown>()
  return {
    async getKeys() {
      return [...map.keys()]
    },
    async getEntries<T>() {
      return [...map.entries()] as [string, T][]
    },
    async getItem<T>(key: string) {
      return map.get(key) as T | undefined
    },
    async setItem<T>(key: string, value: T) {
      map.set(key, value)
    },
    async removeItem(key: string) {
      map.delete(key)
    },
  }
}

function localStore(): Store {
  return {
    async getKeys() {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (key?.startsWith(PREFIX)) keys.push(key.slice(PREFIX.length))
      }
      return keys
    },
    async getEntries<T>() {
      const keys = await this.getKeys()
      const rows: [string, T][] = []
      for (const key of keys) {
        const value = await this.getItem<T>(key)
        if (value !== undefined) rows.push([key, value])
      }
      return rows
    },
    async getItem<T>(key: string) {
      const raw = localStorage.getItem(PREFIX + key)
      if (raw == null) return undefined
      try {
        return JSON.parse(raw) as T
      } catch {
        return undefined
      }
    },
    async setItem<T>(key: string, value: T) {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    },
    async removeItem(key: string) {
      localStorage.removeItem(PREFIX + key)
    },
  }
}

export function createWalletConnectStorage(): Store {
  try {
    if (typeof localStorage === "undefined") return memoryStore()
    const probe = `${PREFIX}probe`
    localStorage.setItem(probe, "1")
    localStorage.removeItem(probe)
    return localStore()
  } catch {
    return memoryStore()
  }
}
