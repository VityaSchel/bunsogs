# Bun SOGS

Session Open Group Server implementation written in JavaScript using [bun.sh](https://bun.sh)

Aims to be very fast, flexible and extensible. Drop-in replacement for pysogs — works with the same database schema. Bunsogs support everything pysogs has, but it's better.

- [Bun SOGS](#bun-sogs)
  - [Core features and comparison table](#core-features-and-comparison-table)
  - [Prerequisites](#prerequisites)
  - [Install](#install)
  - [Plugins](#plugins)
    - [Profanity \& topic moderation filter](#profanity--topic-moderation-filter)
    - [Antispam \[in development\]](#antispam-in-development)
    - [Anticsam \[in development\]](#anticsam-in-development)
    - [Greeting DM messages \[in development\]](#greeting-dm-messages-in-development)
  - [Migration from official pysogs](#migration-from-official-pysogs)
  - [CLI](#cli)
    - [CLI Options](#cli-options)
  - [FAQ](#faq)
    - [Where is data stored?](#where-is-data-stored)
    - [How to create a public broadcasting channel (readonly room)?](#how-to-create-a-public-broadcasting-channel-readonly-room)
    - [How to disable DMs?](#how-to-disable-dms)
    - [How to change rate limiting settings?](#how-to-change-rate-limiting-settings)
    - [How to disable sending media files for one particular user?](#how-to-disable-sending-media-files-for-one-particular-user)
  - [Known issues](#known-issues)
  - [Caveats](#caveats)
  - [Credits](#credits)

## Core features and comparison table

| Feature                                                     | pysogs (official) | bunsogs |
| ----------------------------------------------------------- | ----------------- | ------- |
| Plugins (antispam, anticsam, DM greetings)                  | ❌                | ✅ |
| Bot API                                                     | ❌                | Planned |
| GUI CLI                                                     | ❌                | ✅      |
| Per-room rate limit settings                                | ❌                | ✅      |
| Per-room old messages pruning settings                      | ❌                | Planned |
| Only allow certain attachments (e.g. no images, only voice) | ❌                | Planned |
| Global permissions overrides                                | ❌                | Planned |
|                                                             |                   |         |

And it can be installed anywhere, not just Ubuntu 22 :)

## Prerequisites

You will need a Linux server with a static IP address and a CPU modern enough to support [bun](https://bun.sh). You can use tunnels like [ngrok](https://ngrok.com/) to temporarily host your sogs without owning server or public ip.

This implementation is not intended to be end server, but rather a local webserver. You will need to configure, for example, nginx proxy server, to handle requests and redirect them to this server.

## Install

In future, I'm planning to compile bunsogs to a single executable that can be run without installing bun or dependencies, so you could just download one file and run it anywhere right away.

1. Clone this repository into some folder
  ```
  git clone https://github.com/VityaSchel/bunsogs
  ```
2. Optionally edit `sogs.conf` file with any editor. It's a text file with global settings. You can find explanation of each setting inside of it. You may skip this step if you're not expert in configuring SOGS servers. Rooms are created and configured with bunsogs-cli, not with config.
3. Install [Bun](https://bun.sh/)
  Linux/macOS:
  ```
  curl -fsSL https://bun.sh/install | bash
  ```
  Windows:
  ```
  powershell -c "irm bun.sh/install.ps1 | iex"
  ```
4. Install dependencies:
  ```
  bun install
  ```
  ***P.S. unlike weird python, dependencies will be installed inside node_modules directory INSIDE of bunsogs directory, and not at the system level, so you don't have to manage environments***
  
Finally, start your SOGS:
```
bun start
```
Use this command whenever you want to start server, others are just preparations. Keep in mind that you have to be in the bunsogs directory. You can use `PORT=1234 bun start` and/or `HOSTNAME=192.168.0.1` environmental variables to **override** sogs.config variables for PORT and HOSTNAME

It is your job to configure web server to proxy requests to the specified URL. To leave SOGS running, you can use any persisting daemon you like. For example, to use [pm2](https://www.npmjs.com/package/pm2), install it like this: `bun install -g pm2` and to start daemon, use `pm2 start "bun start" --name="My Session Community"` (provide any name you like), also run `pm2 startup` to add pm2 to system autoruns. Don't forget to increase file size limit from default 1mb if configuring nginx reverse proxy.

You can run as many bunsogs on your machine as you want, just make sure they're on different ports and each instance runs in its own directory.

To add rooms see [CLI](#cli) section.

## Plugins

Plugins are community developed extensible scripts for your SOGS. Below are four plugins maintained by author of the bunsogs. You may install plugins from other developers, but be aware that they will have access to your machine, your sogs (and potentially other sogs on the same machine, if user running this sogs have access to other directories), your networks and database. They are essentially a JavaScript files that can modify behaviour of bunsogs.

To install a plugin, simply download and put it in plugins/ directory. Each plugin has its config, so check that in config.json in plugin's directory and edit if needed. After installation you have to enable the plugin in each room you want to use it in and restart SOGS.

### Profanity & topic moderation filter

Profanity filter plugin analyzes incoming messages for bad words and potentially inappropriate content. It has two modes: 
- simple — checks for common words and abbrevations, this will filter out messages with specific words
- AI mode — makes request to GPT moderation endpoint, this won't filter out messages based on profanity, but instead focuses on restricting certain topics (configurable)

[Read more](https://github.com/VityaSchel/bunsogs-profanity-filter)

### Antispam \[in development\]

Antispam plugin efficiently protects your SOGS from spam (ads, links, scam) and flood (repetetive messages). It works by matching content along several messages instead of restricting single session ID.

[Read more](https://github.com/VityaSchel/bunsogs-antispam)

### Anticsam \[in development\]

Anticsam (anti children sexual abuse material) plugin aims to restrict people who try to send these kind of media to your SOGS. It primarily specifies in dealing with media files, not text content, which can likely be detected by profanity filter's AI mode or antispam plugins. It works by matching known hashes of such materials, which is shared with external API.

[Read more](https://github.com/VityaSchel/bunsogs-anticsam)

### Greeting DM messages \[in development\]

Autogreeting messages plugin sends new people in SOGS a welcoming message. It supports captcha verification out of box.

[Read more](https://github.com/VityaSchel/bunsogs-auto-greetings)

## Migration from official pysogs

Migration is in testing. Please do not consider this production ready. Of course, always keep backup of original pysogs instance to come back anytime.

1. Install bunsogs using steps 1-4 from How to install section (including configuring sogs.conf)
2. Move sogs.db from pysogs to root directory of bunsogs and rename it to db.sqlite3
3. Move uploads directory from pysogs to root directory of bunsogs
4. Copy key_x25519 file from pysogs directory to bunsogs
5. Run bunsogs

## CLI

To add or manage rooms list and settings, admins, moderators, bans, use bunsogs-cli. You can utilize command line interface to manage your bunsogs in two ways:

1. Interactive, human-friendly, **recommended** (i.e. just type `bunsogs-cli` and hit enter)
  - You will be presented with a graphic interface that you can navigate using keyboard arrows
  - Demo:
  - ![bunsogs-cli interactive mode demo gif](https://r2.hloth.dev/bunsogs-demo.gif)
2. With arguments, for automation (e.g. `bunsogs-cli --add-room bun --name "Bun.sh lovers"`)
  - You can pass options to CLI to automate things, because it will simply run the process, output result and exit, you may skip any confirmation prompts with `-y` argument

In any case you should run CLI in the target bunsogs directory. But if you're advanced user, you can configure bunsogs to run from anywhere: add cli directory to your PATH variable (on most OSes, you should run `echo "export PATH=\$PATH:$(pwd)/cli" >> ${HOME}/.$(basename $SHELL)rc && source ${HOME}/.$(basename $SHELL)rc`), then each time you run `bunsogs-cli` command, pass `BUNSOGS_DIR` environment variable with path to targeting bunsogs's root directory with db.sqlite3 and key_x25519.

### CLI Options

**Note: you might find it easier to use brand new interactive mode (just run `bunsogs-cli` command without arguments), instead of supplying options as args**

You can get detailed documentation of cli by running `bunsogs-cli --help`

```
Options:
      --help                                         Show help
      --version                                      Show version number
      --add-room TOKEN                               Add a room with the given token
      --name NAME                                    Set the room's initial name for --add - room; if omitted use the
                                                     token name
      --description DESCRIPTION                      Sets or updates a room's description (with --add-room or --rooms)
      --delete-room TOKEN                            Delete the room with the given token
      --add-moderators SESSIONID [SESSIONID ...]     Add the given Session ID(s) as a moderator of the room given by
                                                     --rooms
      --delete-moderators SESSIONID [SESSIONID ...]  Delete the the given Session ID(s) as moderator and admins of the
                                                     room given by --rooms
      --users SESSIONID [SESSIONID ...]              One or more specific users to set permissions for with --add-perms,
                                                     --remove-perms, --clear-perms. If omitted then the room default
                                                     permissions will be set for the given room(s) instead.
      --add-perms ADD_PERMS                          With --add-room or --rooms, set these permissions to true; takes a
                                                     string of 1-4 of the letters "rwua" for [r]ead, [w]rite, [u]pload,
                                                     and [a]ccess.
      --remove-perms REMOVE_PERMS                    With --add-room or --rooms, set these permissions to false; takes
                                                     the same string as --add-perms, but denies the listed permissions
                                                     rather than granting them.
      --clear-perms CLEAR_PERMS                      With --add-room or --rooms, clear room or user overrides on these
                                                     permissions, returning them to the default setting. Takes the same
                                                     argument as --add-perms.
      --admin                                        Add the given moderators as admins rather than ordinary moderators
      --rooms TOKEN [TOKEN ...]                      Room(s) to use when adding/removing moderators/admins or when
                                                     setting permissions. If a single room name of  is given then the
                                                     user will be added/removed as a global admin/moderator. '+' is not
                                                     valid for setting permissions. If a single room name of '*' is
                                                     given then the changes take effect on each of the server's current
                                                     rooms.
      --visible                                      Make an added moderator/admins' status publicly visible.This is the
                                                     default for room mods, but not for global mods
      --hidden                                       Hide the added moderator/admins' status from public users.This is
                                                     the default for global mods, but not for roommods
  -L, --list-rooms                                   List current rooms and basic stats
  -M, --list-global-mods                             List global moderators/admins

Examples:
  bunsogs-cli --add-room bun --name "Bun.sh lovers"             Add new room "bun"
  bunsogs-cli --rooms bun fish --admin --add-moderators 050123  Add 2 admins to each of rooms "xyz" and "abc"
  456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
  0500112233445566778899aabbccddeeff00112233445566778899aabbcc
  ddeeff
  bunsogs-cli --add-moderators 050123456789abcdef0123456789abc  Add a global moderator visible as a moderator of all
  def0123456789abcdef0123456789abcdef --rooms=+ --visible       rooms
  bunsogs-cli --add-perms rw --remove-perms u --rooms="*"       Set default read/write True and upload False on all
                                                                rooms
  bunsogs-cli --clear-perms rwua --rooms="*" --users 050123456  Remove overrides for user 0501234... on all rooms
  789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

A database will be loaded from current directory, if one exists. You can override this by specifying a path to the directory with db.sqlite3 and key_x25519 files in BUNSOGS_DIR environment variable.
```

Note the difference between `+` and `*`: passing `+` to room means add global moderator which will moderate any rooms on server from now on, passing `*` will add moderator to each existing room sequentially.

## FAQ

### Where is data stored?

Everything is stored inside db.sqlite3 and uploads directory. Periodically copy it in some safe place. Key is stored in key_x25519 file, backup it once.

### How to create a public broadcasting channel (readonly room)?

1. Run `bunsogs-cli`
2. Go to Rooms -> Create a new room
3. Enter new room's token, display name, optional description
4. Select Read-only in room's type

Remember: you can always switch room to read-only mode in room's general settings in bunsogs-cli

### How to disable DMs?

IN DEVELOPMENT!

1. Run `bunsogs-cli`
2. Go to Rooms
3. Select in which room you want to disable DMs
4. Go to General settings -> Participants DMs
5. Switch it to disable

Tip: while you're in general settings, you might want to look at other settings!

### How to change rate limiting settings?

1. Run `bunsogs-cli`
2. Go to Rooms
3. Select in which room you want to disable DMs
4. Go to General settings -> Rate limits
5. Enter new rate limiting settings

Hint: default rate limiting settings are up to 5 messages in time frame of 16 seconds.

### How to disable sending media files for one particular user?

1. Run `bunsogs-cli`
2. Go to Rooms
3. Select in which room you want to configure that permission override
4. Go to Manage users permissions
5. Search for that user by typing their Session ID or select Modify user's permisions
6. Skip Accessible, Read, Write prompts by selecting current values
7. Select False in Upload prompt

If you ever want to restore this user's permissions, simply repeat process until 6th step and then choose Not specified in each prompt, thus resetting all permission overrides to default values in this room.

## Known issues

- Blinded IDs are not supported in CLI
  - Everywhere we accept input, it's Session ID, not blinded ID
  - Possible solution is to either allow to input blinded IDs or create a tool that easily resolves session ids <-> blinded ids
- You can only add one admin/moderator, ban only one user per time
  - We should allow multiple inputs in Session ID fields using `list` type from prompts library

## Caveats

- Bunsogs aims to be fastest, not most compatible
  - Don't expect bunsogs to support legacy API or legacy Session clients, as well as old pysogs database schemas

## Credits

Huge thanks to li0ard for code that is responsible for [blinding Session IDs](https://github.com/theinfinityway/session_id/)

Thanks to official pysogs implementation developers for detailed API