# Bun SOGS

Session Open Group Server implementation written in JavaScript using [bun.sh](https://bun.sh)

Aims to be very fast, flexible and extensible. Drop-in replacement for pysogs — works with the same database schema. Bunsogs support everything pysogs has, but it's better.

- [Bun SOGS](#bun-sogs)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [Install](#install)
  - [Plugins](#plugins)
    - [Profanity \& topic moderation filter](#profanity--topic-moderation-filter)
    - [Antispam \[in development\]](#antispam-in-development)
    - [Anticsam \[in development\]](#anticsam-in-development)
    - [Auto DM messages \& captcha verification](#auto-dm-messages--captcha-verification)
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
  
Follow bunsogs updates in the official announcements sogs:

[https://sogs.hloth.dev/bunsogs?public_key=8948f2d9046a40e7dbc0a4fd7c29d8a4fe97df1fa69e64f0ab6fc317afb9c945](https://sogs.hloth.dev/bunsogs?public_key=8948f2d9046a40e7dbc0a4fd7c29d8a4fe97df1fa69e64f0ab6fc317afb9c945)

## Features

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

| OS/cpu                                  | Pysogs | bunsogs | tested? |
| --------------------------------------- | ------ | ------- | ------- |
| Ubuntu 20                               | ❓     | ✅      | No      |
| Ubuntu 22                               | ✅     | ✅      | Yes     |
| Ubuntu 24                               | ❌     | ✅      | Yes     |
| MacOS arm                               | ❌     | ✅      | Yes     |
| MacOS x64                               | ❌     | ✅      | No      |
| Other linux distros with CPUs pre-2013  | ❌     | ✅      | No      |
| Other linux distros with CPUs post-2013 | ❌     | ✅      | No      |
|                                         |        |         |         |

If you run bunsogs successfully on any untested platform, make sure to [tell me](mailto:bunsogs@hloth.dev) and I will update this table.

## Prerequisites

You will need a Linux server with a static IP address and a CPU modern enough to support [bun](https://bun.sh). You can use tunnels like [ngrok](https://ngrok.com/) to temporarily host your sogs without owning server or public ip.

This implementation is not intended to be end server, but rather a local webserver. You will need to configure, for example, nginx proxy server, to handle requests and redirect them to this server.

## Install

Follow this easy method of installing and configuring bunsogs:

1. Go to [releases page](https://github.com/VityaSchel/bunsogs/releases)
2. Download zip for your OS
3. Unpack zip, open terminal, go to bunsogs directory with unpacked content
4. Optionally edit `sogs.conf` file with any editor. It's a text file with global settings. You can find explanation of each setting inside of it. You may skip this step if you're not expert in configuring SOGS servers. Rooms are created and configured with bunsogs-cli, not with config.
5. Finally run your SOGS by typing `./bunsogs` in bunsogs directory. First time you run it, you should see a message indicating that a secret keypair was created and database was initialized. After that run `./bunsogs-cli` to manage your rooms and SOGS. [Read more about CLI in its section](#cli).

Alternatively, [run source code](./CONTRIBUTING.md#running-source-code), it's not that hard 🙃

**Always start bunsogs by typing command in bunsogs directory**, otherwise you'll get errors like `Failed to find ./sogs.conf`
 
You can use `PORT=1234` and/or `HOSTNAME=192.168.0.1` environmental variables to **override** sogs.conf variables for PORT and HOSTNAME.

It's your job to configure web server to proxy requests to the specified URL. Bunsogs never tries to be an end server for your users. It's recommended to run some kind of reverse proxy, such as nginx, that will point to local bunsogs instance. Make sure you change `url` in sogs.conf config file to your publicly accessible url. Don't forget to [increase file size limit from default 1mb](https://stackoverflow.com/questions/28476643/default-nginx-client-max-body-size) if configuring nginx reverse proxy.

To leave SOGS running, you can use any persisting daemon you like, it can be just a [crontab script](https://phoenixnap.com/kb/crontab-reboot) that starts bunsogs on server restart or Linux's [screen](https://www.howtogeek.com/662422/how-to-use-linuxs-screen-command/) or more complicated [pm2](https://www.npmjs.com/package/pm2) (for example use `pm2 start "bun start" --name="My Session Community"` provide any name you like, also run `pm2 startup` to add pm2 to system autoruns). 

You can run as many bunsogs on your machine as you want, just make sure they're on different ports and each instance runs in its own directory.

## Plugins

Plugins are community developed extensible scripts for your SOGS. Below are four plugins maintained by author of the bunsogs. You may install plugins from other developers, but be aware that they will have access to your machine, your sogs (and potentially other sogs on the same machine, if user running this sogs have access to other directories), your networks and database. They are essentially a JavaScript files that can modify behaviour of bunsogs.

To install a plugin, simply download and put it in plugins/ directory. Each plugin has its config, so check that in config.json in plugin's directory and edit if needed. After installation you have to enable the plugin in each room you want to use it in and restart SOGS.

### Profanity & topic moderation filter

Profanity filter plugin analyzes incoming messages for bad words on 54 languages and potentially inappropriate content. It has two modes which can work simultaniously: 
- simple — checks for common words and abbrevations, this will filter out messages with specific words
- GPT mode — makes request to GPT moderation endpoint, this won't filter out messages based on profanity, but instead focuses on restricting certain topics (configurable)

[Read more](https://github.com/VityaSchel/bunsogs-profanity-filter)

### Antispam \[in development\]

Antispam plugin efficiently protects your SOGS from spam (ads, links, scam) and flood (repetetive messages). It works by matching content along several messages instead of restricting single session ID.

[Read more](https://github.com/VityaSchel/bunsogs-antispam)

### Anticsam \[in development\]

Anticsam (anti children sexual abuse material) plugin aims to restrict people who try to send these kind of media to your SOGS. It primarily specifies in dealing with media files, not text content, which can likely be detected by profanity filter's AI mode or antispam plugins. It works by matching known hashes of such materials, which is shared with external API.

[Read more](https://github.com/VityaSchel/bunsogs-anticsam)

### Auto DM messages & captcha verification

Autogreeting messages plugin sends new people in SOGS a welcoming message. It supports captcha verification out of box.

[Read more](https://github.com/VityaSchel/bunsogs-auto-dm)

## Migration from official pysogs

Migration is experimental feature. Please do not consider this production ready. Of course, always keep backup of original pysogs instance to come back anytime.

1. Install bunsogs using steps 1-4 from How to install section (including configuring sogs.conf)
2. Move sogs.db from pysogs to root directory of bunsogs and rename it to db.sqlite3
3. Move uploads directory from pysogs to root directory of bunsogs
4. Copy key_x25519 file from pysogs directory to bunsogs
5. Run bunsogs

## CLI

To add or manage rooms list and settings, admins, moderators, bans, use bunsogs-cli. You can utilize command line interface to manage your bunsogs in two ways:

1. Interactive, human-friendly, **recommended** (i.e. just type `./bunsogs-cli` and hit enter)
  - You will be presented with a graphic interface that you can navigate using keyboard arrows
  - Demo:
  - ![bunsogs-cli interactive mode demo gif](https://r2.hloth.dev/bunsogs-demo.gif)
2. With arguments, for automation (e.g. `./bunsogs-cli --add-room bun --name "Bun.sh lovers"`)
  - You can pass options to CLI to automate things, because it will simply run the process, output result and exit, you may skip any confirmation prompts with `-y` argument

In any case you must run CLI in the target bunsogs directory.

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

Everything is stored inside db.sqlite3 and uploads directory. Make regular copies of it in some safe place. Key is stored in key_x25519 file, backup it once.

### How to create a public broadcasting channel (readonly room)?

1. Run `bunsogs-cli`
2. Go to Rooms -> Create a new room
3. Enter new room's token, display name, optional description
4. Select Read-only in room's type

Remember: you can always switch room to read-only mode and other modes in room's general settings in bunsogs-cli. This is essentially room's default permissions, same as in pysogs.

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

- Modifying bunsogs with bunsogs-cli while it's running is not recommended, as some changes may not be reflected instantly and some might not be reflected until the next bunsogs restart. Also you might run into `database locked` errors.
- Blinding does not work
  - There are some issues with blinding Session ID, sometimes it just doesn't work despite algorithm being pretty much the same as pysogs and libsession implementations
  - You should write blinded session id by client instead of clear unblinded session ID into CLI
- You can only add one admin/moderator, ban only one user per time
  - We should allow multiple inputs in Session ID fields using `list` type from prompts library

## Caveats

- Bunsogs aims to be fastest, not most compatible
  - Don't expect bunsogs to support legacy API or legacy Session clients, as well as old pysogs database schemas

## Credits

Huge thanks to li0ard for code that is responsible for [blinding Session IDs](https://github.com/theinfinityway/session_id/)

Thanks to official pysogs implementation developers for detailed API