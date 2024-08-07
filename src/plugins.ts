import path from 'path'
import { glob } from 'glob'
import fs from 'fs/promises'
import SJSON from 'secure-json-parse'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import chalk from 'chalk'

const plugins: { name: string, worker: Worker }[] = []

export async function loadPlugins() {
  const pluginsManifests = await glob(path.join(__dirname, '../plugins/*/package.json'))
  for (const manifest of pluginsManifests) {
    const packageJsonSerialized = await fs.readFile(manifest, 'utf-8')
    const packageJson = SJSON.parse(packageJsonSerialized)
    const parsed = await z.object({
      module: z.string().min(1).optional(),
      main: z.string().min(1).optional()
    }).safeParseAsync(packageJson)
    if (!parsed.success || (!parsed.data.main && !parsed.data.module)) {
      console.error(`Could not load ${manifest}: Invalid package.json`)
      continue
    }
    const entryPoint = path.join(path.dirname(manifest), (parsed.data.main || parsed.data.module) as string)
    try {
      await fs.access(entryPoint)
    } catch (e) {
      console.error(`Could not load ${manifest}:`, e)
      continue
    }
    const worker = new Worker(entryPoint, { type: 'module' })
    plugins.push({
      name: packageJson.name,
      worker
    })
  }
  process.on('SIGINT', () => { unloadPlugins() })
  return plugins
}

export function unloadPlugins() {
  for (let i = plugins.length - 1; i >= 0; i--) {
    const plugin = plugins[i]
    plugin.worker.terminate()
    plugins.splice(i, 1)
  }
}

export function requestPlugins(type: string, payload: object) {
  const requests = new Map<string, Promise<undefined | object>>()
  for (const plugin of plugins) {
    const id = uuid()
    const message = { type, payload, ref: id }
    requests.set(id, new Promise<undefined | object>((resolve) => {
      const callback = (response: Bun.MessageEvent) => {
        const { ok, ref, error, ...payload } = response.data
        if (ref === id) {
          if (ok === false && error) {
            console.error(chalk.bgRedBright(chalk.white(`Plugin ${plugin.name} error:`)), chalk.redBright(error))
          }
          resolve(ok ? payload : undefined)
          plugin.worker.removeEventListener('message', callback)
        }
      }
      plugin.worker.addEventListener('message', callback)
      plugin.worker.postMessage(message)
    }))
  }
  return Promise.all(requests.values())
}