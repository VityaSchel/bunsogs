let globalAdmins: Set<string>
let globalModerators: Set<string>

export async function loadGlobalSettings(): Promise<void> {
  await Promise.all([
    loadGlobalAdmins(),
    loadGlobalModerators()
  ])
}

async function loadGlobalAdmins(): Promise<void> {
  // TODO
  globalAdmins = new Set()
}

async function loadGlobalModerators(): Promise<void> {
  // TODO
  globalModerators = new Set()
}

export function isUserGlobalAdmin(id: string): boolean {
  return globalAdmins.has(id)
}

export function isUserGlobalModerator(id: string): boolean {
  return globalModerators.has(id)
}