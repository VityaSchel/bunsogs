# Plugins

Plugins are installed to SOGS by placing directory with plugin to /plugins directory. They can then be enabled per-room by SOGS administrator.

- [Plugins](#plugins)
  - [Plugins development](#plugins-development)
    - [1. Initialize](#1-initialize)
    - [2. config.json](#2-configjson)
    - [3. Start developing](#3-start-developing)
  - [API reference](#api-reference)
    - [Hooks and callbacks](#hooks-and-callbacks)
      - [`onBeforePost` hook](#onbeforepost-hook)
      - [`onRecentMessagesRequest` callback](#onrecentmessagesrequest-callback)
    - [Classes](#classes)
      - [Class User](#class-user)
      - [Class Room](#class-room)
    - [Methods](#methods)
      - [`banUser`](#banuser)
      - [`unbanUser`](#unbanuser)
      - [`setUserPermissions`](#setuserpermissions)
  - [Logging and debugging](#logging-and-debugging)

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
self.addEventListener('message', event => {
  if(event.data.ref) {
    // hooks that you must respond to
    // Always return `ref` — it tells SOGS that the message you sent is a response to the specific request
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
  } else {
    // callbacks that act as notifications
    switch(event.data.type) {
      case 'onRecentMessagesRequest':
        console.log(event.data.payload)
        break
      default:
        // callbacks do not require answer
        break
    }
  }
})
```

If your plugin returns `{"ok": false}` on hook, bunsogs will ignore it and depend on other plugins result. You can optionally add `error` to your failure response and bunsogs will log it into terminal.

### Hooks and callbacks

Hooks are requests made to your plugin that block SOGS. You must respond to them. They also have `ref` property in event's data.

Callbacks are events that notify your plugin about certain events happened in SOGS. They do not require answer and won't process it. They don't have `ref` property in event's data.

#### `onBeforePost` hook

Called when new message is posted to the SOGS. 

Payload:
- `message` — object with message content
  - `text` — text content of message
  - `author` — author of the message. Class: [User](#class-user)
  - `room` — room where message was sent. Class: [Room](#class-room)

Example payload:
```js
event.data.payload = {
  message: {
    author: user,
    text: 'Foo bar'
  }
}
```

You should return `action` property where `send` means allow to send and `reject` means reject request to send.

Example response:

```js
response.data = {
  ok: true,
  action: 'reject',
  ref: event.data.ref
}
```

**How it works with multiple plugins?** If any of plugins return `reject` — the message is rejected, otherwise it is sent as normal.

#### `onRecentMessagesRequest` callback

Called when user requested `/room/:token/messages/recent`

Payload:
- `room` — room, that was requested. Class: [Room](#class-room)
- `user` — user that made request, might be `null` if request made anonymously. Class: [User](#class-user)

Example payload:
```js
event.data.payload = {
  user: user, // can be null
  room: room
}
```

No response required.

### Classes

#### Class User

Represents User in SOGS.

- `id` — user's numeric unique identificator in this sogs server
- `session_id` — blinded Session ID of author, starting with `15`; blinded session ids are different among sogs
- `admin` — is global admin
- `moderator` — is global moderator
- `roomPermissions` — permissions in current room
  - `banned` - is user banned in current room
  - `read` - can user read messages
  - `accessible` - can user access room
  - `write` - can user post messages to this room
  - `upload` - can user upload files to this room
  - `moderator` - is user room's moderator
  - `admin` - is user room's admin

Example:
```js
user = {
  id: 0,
  session_id: '15383d0a3ba605abe3b5b7343102be3fc0026056b9812e06f6daee3be62a6a56e3',
  admin: false,
  moderator: false,
  roomPermissions: {
    banned: false,
    read: true,
    accessible: true,
    write: true,
    upload: true,
    moderator: true,
    admin: false
  }
}
```

#### Class Room

Represents Room in SOGS.

- `id` — room numeric identificator
- `token` — room string token

Example:
```js
room = {
  id: 1,
  token: 'test'
}
```

### Methods

Your plugin may call async methods in any point in time to interact with bunsogs. For example, that's what [bunsogs-auto-dm](https://github.com/VityaSchel/bunsogs-auto-dm) plugin does to check new users with captcha and then add write permission to verified users.

Call methods by sending postMessage in plugin's code:

```ts
postMessage({
  method: 'banUser',
  user: '15b9460609fc38171c9afbec8411f55ef206c4e836461b32c19aac436bf187d4c6',
  room: 'test'
})
```

#### `banUser`

Bans specified user in specified room. Restricts user from accessing room, room's content or writing anything to it. If you want to mute user, use [setUserPermissions](#setuserpermissions) method with write=false permission.

Request:
| Key     | Type                            | Description                                                                                                                                     |
| ------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| user    | `string` or `number`            | If string, must be either blinded (prefix 15) or unblinded (prefix 05) Session ID. If number, must be user ID on this bunsogs                   |
| room    | `string` or `number` (optional) | Optional: if not specified, user will be banned globally. If string, must be room's token. If number, must be room's id on this bunsogs server. |
| timeout | `number` (optional)             | If specified, ban will be lifted automatically after that number of seconds                                                                     |
|         |                                 |                                                                                                                                                 |

#### `unbanUser`

Removes ban from specified user in (optionally) specified room.

Request:
| Key  | Type                            | Description                                                                                                                                     |
| ---- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| user | `string` or `number`            | If string, must be either blinded (prefix 15) or unblinded (prefix 05) Session ID. If number, must be user ID on this bunsogs                   |
| room | `string` or `number` (optional) | Optional: if not specified, user will be banned globally. If string, must be room's token. If number, must be room's id on this bunsogs server. |
|      |                                 |                                                                                                                                                 |

#### `setUserPermissions`

Modifies specified user's permissions in (optionally) specified room. Do not use this to ban person, instead use `banUser` method.

Request:
| Key        | Type                           | Description                                                                                                                                                                                                                                                      |
| ---------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| user       | `string` or `number`           | If string, must be either blinded (prefix 15) or unblinded (prefix 05) Session ID. If number, must be user ID on this bunsogs                                                                                                                                    |
| room       | `string` or `number`           | If string, must be room's token. If number, must be room's id on this bunsogs server.                                                                                                                                                                            |
| accessible | `boolean` or `null` (optional) | Optional: only specify this if you want to change that permission from the current user permission override. Pass `true` or `false` to allow or deny user to see this room. Pass `null` to reset this permission to default, provided by this room.              |
| read       | `boolean` or `null` (optional) | Optional: only specify this if you want to change that permission from the current user permission override. Pass `true` or `false` to allow or deny user to read messages in this room. Pass `null` to reset this permission to default, provided by this room. |
| write      | `boolean` or `null` (optional) | Optional: only specify this if you want to change that permission from the current user permission override. Pass `true` or `false` to allow or deny sending messages for that user. Pass `null` to reset this permission to default, provided by this room.     |
| upload     | `boolean` or `null` (optional) | Optional: only specify this if you want to change that permission from the current user permission override. Pass `true` or `false` to allow or deny uploading files for this user. Pass `null` to reset this permission to default, provided by this room.      |
|            |                                |                                                                                                                                                                                                                                                                  |

## Logging and debugging

Use postMessage with `{ type: 'log', message: 'any string you like' }` to log messages to operator's console.

For example (plugin code):

```ts
postMessage({ type: 'log', message: profanityWords.size + ' words loaded' })
```

Bunsogs console:

```
Plugin bunsogs-profanity-filter: 4499 words loaded
```

Additionally you might want to add `dev: true` to your message payload so it's only visible when bunsogs is started in development mode with BUNSOGS_DEV=true:

```ts
postMessage({ type: 'log', message: profanityWords.size + ' words loaded', dev: true })
// only visible when bunsogs is started with BUNSOGS_DEV=true env variable
```