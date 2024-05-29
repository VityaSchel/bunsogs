# Bun SOGS

Session Open Group Server implementation written in JavaScript using [bun.sh](https://bun.sh)

Aims to be very fast, flexible and extensible. Drop-in replacement for pysogs — works with the same database schema.

## Core features and comparison table

| Feature                                    | pysogs (official) | bunsogs |
| ------------------------------------------ | ----------------- | ------- |
| Plugins (antispam, anticsam, DM greetings) | ❌                | ✅      |
| Per-room rate limit settings               | ❌                | ✅      |
| Bot API                                    | ❌                | ✅      |
| GUI CLI                                    | ❌                | ✅      |
| Auto deleting old messages                 | ❌                | ✅      |
|                                            |                   |         |

And it can be installed anywhere, not just Ubuntu 22 :)

## Prerequisites

You will need a Linux server with a static IP address and a CPU modern enough to support [bun](https://bun.sh). You can use tunnels like [ngrok](https://ngrok.com/) to temporarily host your sogs without owning server or public ip.

This implementation is not intended to be end server, but rather a local webserver. You will need to configure, for example, nginx proxy server, to handle requests and redirect them to this server.

## How to install

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
Use this command whenever you want to start server, others are just preparations. You can use `PORT=1234 bun start` and/or `HOSTNAME=192.168.0.1` environmental variables to **override** sogs.config variables for PORT and HOSTNAME

It is your job to configure web server to proxy requests to the specified URL. To leave SOGS running, you can use any persisting daemon you like. For example, to use [pm2](https://www.npmjs.com/package/pm2), install it like this: `bun install -g pm2` and to start daemon, use `pm2 start "bun start" --name="My Session Community"` (provide any name you like), also run `pm2 startup` to add pm2 to system autoruns.

You can run as many bunsogs on your machine as you want, just make sure they're on different ports and each instance runs in its own directory.

## Plugins Configuration

Plugins are community developed extensible scripts for your SOGS. Below are four plugins maintained by author of the bunsogs. You may install plugins from other developers, but be aware that they will have access to your machine, your sogs (and potentially other sogs on the same machine, if user running this sogs have access to other directories), your networks and database. They are essentially a JavaScript files that can modify behaviour of bunsogs.

To install a plugin, simply download and put it in plugins/ directory. Each plugin has its config, so check that in config.json in plugin's directory and edit if needed.

### Profanity filter

In progress

### Alphabet filter

In progress

### Antispam

In progress

### Greeting DM messages

In progress

## Migration from official pysogs

1. Install bunsogs using steps 1-4 from How to install section (including configuring sogs.conf)
2. Move sogs.db from pysogs to root directory of bunsogs and rename it to db.sqlite3
3. Move uploads directory from pysogs to root directory of bunsogs
4. Copy key_x25519 file from pysogs directory to bunsogs
5. Run bunsogs

## CLI

To add or manage rooms, rooms admins and moderators and global server admins and moderators, use bunsogs-cli. You can utilize command line interface to manage your bunsogs in two ways:

1. Interactive, human-friendly, **recommended** (i.e. just type `bunsogs-cli` and hit enter)
  - You will be presented with a graphic interface that you can navigate using keyboard arrows
2. With arguments, for automation (e.g. `bunsogs-cli --add-room bun --name "Bun.sh lovers"`)
  - You can pass options to CLI to automate things, because it will simply run the process, output result and exit, you may skip any confirmation prompts with `-y` argument

In any case you should run CLI in the target bunsogs directory. But if you're advanced user, you can configure bunsogs to run from anywhere: add cli directory to your PATH variable (on most OSes, you should run `echo "export PATH=\$PATH:$(pwd)/cli" >> ${HOME}/.$(basename $SHELL)rc && source ${HOME}/.$(basename $SHELL)rc`), then each time you run `bunsogs-cli` command, pass `BUNSOGS_DB` environment variable with path to targeting bunsogs's db.sqlite3.

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

A database will be loaded from current directory, if one exists. You can override this by specifying a path to the
db.sqlite3 to load in BUNSOGS_DB environment variable.
```

Note the difference between `+` and `*`: passing `+` to room means add global moderator which will moderate any rooms on server from now on, passing `*` will add moderator to each existing room sequentially.

## Where is data stored?

Everything is stored inside db.sqlite3 and uploads directory. Periodically copy it in some safe place. Key is stored in key_x25519 file, backup it once.

## Credits

Huge thanks to li0ard for code that is responsible for [blinding Session IDs](https://github.com/theinfinityway/session_id/)

Thanks to official pysogs implementation developers for detailed API