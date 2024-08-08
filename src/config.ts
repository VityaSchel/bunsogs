import { z } from 'zod'
import fs from 'fs/promises'
import chalk from 'chalk'
import _ from 'lodash'

const filesizeRegex = /^(\d+(\.\d)?)(B|KB|MB)$/i

const configSchema = z.object({
  port: z.number().int().min(1).max(65535),
  hostname: z.string(),
  expiry: z.number().int().min(0),
  max_size: z.number().int().min(1).max(6000000),
  active_threshold: z.number().int().min(1),
  active_prune_threshold: z.number().int().min(1),
  history_prune_threshold: z.number().int().min(1),
  dm_expiry: z.number().int().min(0),
})

export type Config = z.infer<typeof configSchema>
let config: Config
export async function loadConfig() {
  try {
    await fs.access('./sogs.conf', fs.constants.F_OK)
  } catch {
    console.error(chalk.bold(chalk.red('  [!] Failed to find ./sogs.conf [!]')))
    console.error(chalk.red('  Looks like you\'re missing sogs.conf file in current working directory.'))
    console.error(chalk.red('  Here is a template for you:'))
    console.error(chalk.bold(chalk.red('  https://github.com/VityaSchel/bunsogs/tree/main/sogs.conf')))
    console.error(chalk.red('  download it and put it in the same directory as SOGS.'))
    console.log()
    process.exit(0)
  }

  let configContents: string
  try {
    configContents = await fs.readFile('./sogs.conf', 'utf-8')
  } catch {
    console.error(chalk.bold(chalk.red('  [!] Failed to read ./sogs.conf [!]')))
    console.error(chalk.red('  File can be seen but cannot be read.'))
    console.error(chalk.red('  Please check file permissions.'))
    console.log()
    process.exit(0)
  }

  let parsedConfig: Map<string, string | number>
  try {
    parsedConfig = await parseConfig(configContents)
  } catch(e) {
    console.error(chalk.bold(chalk.red('  [!] Failed to parse sogs.conf [!]')))
    if(e instanceof Error) {
      console.error(chalk.red('  ' + e.message))
    }
    console.log()
    process.exit(0)
  }

  if (typeof parsedConfig.get('max_size') === 'string') {
    if(z.string().regex(filesizeRegex).safeParse(parsedConfig.get('max_size')).success) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const matches = (parsedConfig.get('max_size') as string).match(filesizeRegex) as RegExpMatchArray
      const size = matches[1]
      const unit = matches[3]
      switch (unit.toUpperCase()) {
        case 'B':
          parsedConfig.set('max_size', Number(size))
          break
        case 'KB':
          parsedConfig.set('max_size', Number(size) * 1000)
          break
        case 'MB':
          parsedConfig.set('max_size', Number(size) * 1000 * 1000)
          break
      }
    } else {
      console.error(chalk.bold(chalk.red('  [!] Failed to validate sogs.conf [!]')))
      console.error(chalk.red('  `max_size`: Accepted formats: 1B, 1KB, 1MB, 0.1B, 0.1KB, 0.1MB'))
      console.log()
      process.exit(0)
    }
  }

  try {
    config = configSchema.parse(Object.fromEntries(parsedConfig))
  } catch(e) {
    console.error(chalk.bold(chalk.red('  [!] Failed to validate sogs.conf [!]')))
    if(e instanceof z.ZodError) {
      for(const error of e.errors) {
        console.error(chalk.red(`  \`${error.path}\`: ${error.message}`))
      }
    }
    console.log()
    process.exit(0)
  }

  return config
}

export function getConfig() {
  return config
}

function parseConfig(contents: string) {
  const lines = contents.split('\n')
    .map<[string, number]>((line, i) => [line.trim(), i])
    .filter(([line]) => line.length > 0 && !line.startsWith('#'))

  const config: Map<string, string | number> = new Map()

  for (const [line, number] of lines) {
    const separatorIndex = line.indexOf('=')
    if(separatorIndex === -1) {
      throw new Error('Unknown line format at line ' + (number + 1) + ': ' + line)
    }

    const property = line.substring(0, separatorIndex).trim()
    const value = line.substring(separatorIndex + 1).trim()
    if(config.has(property)) {
      throw new Error('Duplicate property at line ' + (number + 1) + ': ' + property)
    }
    if(!Number.isNaN(Number(value)) && Number.isFinite(Number(value))) {
      config.set(property, Number(value))
    } else {
      config.set(property, value)
    }
  }

  return config
}