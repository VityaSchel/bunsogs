import prompts from 'prompts'

export const clearLines = (count) => {
  process.stdout.write(`\x1b[${count}A`)
  process.stdout.write('\x1b[0J')
}

export const showSuccess = async (message: string) => {
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: '' + message,
    choices: [
      { title: 'OK', value: 'ok' }
    ],
    hint: ' '
  })
  clearLines(1)
  return response.value === 'ok'
}

export const showError = async (e: any) => {
  let message: string
  if (e instanceof Error) {
    message = 'Error: ' + e.message
  } else if (typeof e === 'string') {
    message = e
  } else {
    message = 'Unknown error'
  }
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: '\x07\x1b[37;41;1m' + message + '\x1b[49m',
    choices: [
      { title: 'OK', value: 'ok' }
    ],
    hint: ' '
  })
  clearLines(1)
  return response.value === 'ok'
}