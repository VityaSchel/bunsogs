# Bun SOGS

Session Open Group Server implementation written in JavaScript using [bun.sh](https://bun.sh)

Aims to be very fast, flexible and extensible. Drop-in replacement for pysogs — works with the same database schema.

## Core features and comparison table

| Feature                                   | pysogs (official) | bunsogs |
| ----------------------------------------- | ----------------- | ------- |
| Plugins (antispam, filters, DM greetings) | ❌                | ✅      |
| Bot API                                   | ❌                | ✅      |
| Auto deleting old messages                | ❌                | ✅      |
| CLI                                       | ✅                | ✅      |
|                                           |                   |         |

And it can be installed anywhere, not just Ubuntu 22

## Prerequisites

You will need a Linux server with a static IP address and a CPU modern enough to support [bun](https://bun.sh). It will probably work on Windows, but not tested.

This implementation is not intended to be end server, but rather a local webserver. You will need to configure, for example, nginx proxy server, to handle requests and redirect them to this server.

## How to install

1. Clone this repository into some folder
  ```
  git clone https://github.com/VityaSchel/bunsogs
  ```
2. Edit `sogs.conf` file with any editor. It's a text file with settings. You can find explanation of each setting inside of it.
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
Use this command whenever you want to start server, others are just preparations

It is your job to configure web server to proxy requests to the specified URL. To leave SOGS running, you can use any persisting daemon you like. For example, to use [pm2](https://www.npmjs.com/package/pm2), install it like this: `bun install -g pm2` and to start daemon, use `pm2 start "bun start" --name="My Session Community"` (provide any name you like), also run `pm2 startup` to add pm2 to system autoruns.

## Migration from official pysogs

1. Install bunsogs using steps 1-4 from How to install section (including configuring sogs.conf)
2. Move sogs.db from pysogs to root directory of bunsogs and rename it to db.sqlite3
3. Move uploads directory from pysogs to root directory of bunsogs
4. Copy key_x25519 file from pysogs directory to bunsogs
5. Run bunsogs

## Where is data stored?

Everything is stored inside db.sqlite3 and uploads directory. Periodically copy it in some safe place. Key is stored in key_x25519 file, backup it once.