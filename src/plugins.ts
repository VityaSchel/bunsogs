import path from 'path'
import { glob } from 'glob'
import fs from 'fs/promises'
import SJSON from 'secure-json-parse'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import chalk from 'chalk'
import * as API from './api'

type Plugin = { name: string, worker: Worker }

const plugins: Plugin[] = []

export async function loadPlugins() {
  const pluginsManifests = await glob('./plugins/*/package.json')
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
    worker.addEventListener('error', e => {
      console.error(chalk.bgRedBright(chalk.white(`Plugin ${packageJson.name} error:`)), chalk.redBright(e.message))
    })
    worker.addEventListener('message', e => {
      if(typeof e === 'object') {
        if('type' in e.data && e.data.type === 'log') {
          console.log(chalk.bgWhiteBright(chalk.black(`Plugin ${packageJson.name}:`)), chalk.white(e.data.message))
        } else if('method' in e.data && typeof e.data.method === 'string') {
          handlePluginMethod({
            name: packageJson.name,
            data: e.data
          })
            .catch(e => {
              if(process.env.BUNSOGS_DEV === 'true') {
                console.error(chalk.bgRedBright(chalk.white(`Plugin ${packageJson.name} error:`)), chalk.redBright(e.toString()))
                console.error(chalk.redBright(e.stack))
              }
            })
        }
      }
    })
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

export function sendPluginMessage(type: string, payload: object) {
  for (const plugin of plugins) {
    plugin.worker.postMessage({ type, payload })
  }
}

async function handlePluginMethod({ name, data }: { name: string, data: { method: string, [key: string]: any } }) {
  const { method, ...payload } = data
  switch (method) {
    case 'banUser': {
      const params = API.paramsSchemas.banUser.parse(payload)
      if (params.room !== undefined) {
        await API.banUserInRoom({ user: params.user, room: params.room, timeout: params.timeout })
      } else {
        await API.banUser({ user: params.user, timeout: params.timeout })
      }
      break
    }
    case 'unbanUser': {
      const params = API.paramsSchemas.unbanUser.parse(payload)
      if (params.room !== undefined) {
        await API.unbanUserInRoom({ user: params.user, room: params.room })
      } else {
        await API.unbanUser({ user: params.user })
      }
      break
    }
    case 'setUserPermissions': {
      const params = API.paramsSchemas.setUserPermissions.parse(payload)
      await API.setUserPermissions({ user: params.user, room: params.room, accessible: params.accessible, read: params.read, write: params.write, upload: params.upload })
      break
    }
    case 'sendDm': {
      const params = API.paramsSchemas.sendDm.parse(payload)
      await API.sendDm({ from: params.from, to: params.to, message: params.message })
      break
    }
    case 'sendMessage': {
      const params = API.paramsSchemas.sendMessage.parse(payload)
      await API.sendMessage({ user: params.user, room: params.room, data: params.data, signature: params.signature, whisperTo: params.whisperTo, whisperMods: params.whisperMods, files: params.files })
      break
    }
    case 'setRoomAdmin': {
      const params = API.paramsSchemas.setRoomAdmin.parse(payload)
      await API.setRoomAdmin({ user: params.user, room: params.room, visible: params.visible })
      break
    }
    case 'setRoomModerator': {
      const params = API.paramsSchemas.setRoomModerator.parse(payload)
      await API.setRoomAdmin({ user: params.user, room: params.room, visible: params.visible })
      break
    }
    case 'setGlobalAdmin': {
      const params = API.paramsSchemas.setGlobalAdmin.parse(payload)
      await API.setGlobalAdmin({ user: params.user, visible: params.visible })
      break
    }
    case 'setGlobalModerator': {
      const params = API.paramsSchemas.setGlobalModerator.parse(payload)
      await API.setGlobalModerator({ user: params.user, visible: params.visible })
      break
    }
    case 'removeRoomAdmin': {
      const params = API.paramsSchemas.removeRoomAdmin.parse(payload)
      await API.removeRoomAdmin({ user: params.user, room: params.room })
      break
    }
    case 'removeRoomModerator': {
      const params = API.paramsSchemas.removeRoomModerator.parse(payload)
      await API.removeRoomModerator({ user: params.user, room: params.room })
      break
    }
    case 'removeGlobalAdmin': {
      const params = API.paramsSchemas.removeGlobalAdmin.parse(payload)
      await API.removeGlobalAdmin({ user: params.user })
      break
    }
    case 'removeGlobalModerator': {
      const params = API.paramsSchemas.removeGlobalModerator.parse(payload)
      await API.removeGlobalModerator({ user: params.user })
      break
    }
    default:
      console.error(chalk.bgRedBright(chalk.white(`Plugin ${name}`)), chalk.redBright('called unknown method', method + '. Verify you\'re running correct version of the plugin and compatible version of bunsogs.'))
  }
}