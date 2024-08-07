# Plugins

Plugins are installed to SOGS by placing directory with plugin to /plugins directory. They can then be enabled per-room by SOGS administrator.

## Plugins development

### 1. Initialize

Start by running `bun init` in directory. Edit README.md for users and explain why your plugin is useful. You can decide to use src/ directory but this is not neccessary. You shouldn't build or compile your plugin, as Bun can interpret TypeScript on fly.

Name field in package.json will be used as display name in CLI. You can change it between updates, as SOGS only store enabled plugins by path to plugin directory. Your package.json must have `module` or `main` property that points to index file.

### 2. config.json

Add config.json to root directory. This file will be used to configure the plugin's settings. You can optionally allow user to configure settings per-room, this is handled by your code.

### 3. Start developing

Bunsogs uses [Worker interface](https://bun.sh/docs/api/workers) to load your plugin. Add listener for `message` to start listening for hooks. Respond with postMessage global method. Refer to section below to see examples.

## API reference

Your plugin receives events via worker events, responds to it with specific logic and bunsogs will do the rest.

**worker/index.ts**
```ts
// Always return `ref` — it tells SOGS that the message you sent is a response to the specific request

self.addEventListener('message', event => {
  switch(event.data.type) {
    case 'onBeforePost':
      console.log(event.data.payload.message)
      postMessage({ ok: true, action: 'send', ref: event.data.ref })
      break
    default:
      // return { ok: false } because other hooks are not implemented
      postMessage({ ok: false, ref: event.data.ref })
      // this is important because otherwise SOGS will indefinetely wait for your plugin response
      break
  }
})
```

If your plugin returns `{"ok": false}`, bunsogs will ignore it and depend on other plugins result. You can optionally add `error` to your failure response and bunsogs will log it into terminal.

### `onBeforePost` hook

Called when new message is posted to the SOGS. 

Payload:
`message` — object with message content

You should return `send` property where `send` means allow to send and `reject` means reject request to send.

**How it works with multiple plugins?** If any of plugins return `reject` — the message is rejected, otherwise it is sent as normal.