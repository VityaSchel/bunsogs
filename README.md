# Bun SOGS

Session Open Group Server implementation written in JavaScript using [bun.sh](https://bun.sh)

Aims to be very fast and flexible.

## Core features and comparison table

| Feature                                   | pysogs (official) | bunsogs |
| ----------------------------------------- | ----------------- | ------- |
| Plugins (antispam, filters, DM greetings) | ❌                | ✅      |
| Bot API                                   | ❌                | ✅      |
| Auto deleting old messages                | ❌                | ✅      |
| CLI                                       | ✅                | ✅      |
|                                           |                   |         |

## Prerequisites

You will need a Linux server with a static IP address and a CPU modern enough to support [bun](https://bun.sh). It will probably work on Windows, but not tested.

This implementation is not intended to be end server, but rather a local webserver. You will need to configure, for example, nginx proxy server, to handle requests and redirect them to this server.

## How to install

1. Clone this repository into some folder
  ```
  git clone https://github.com/VityaSchel/bunsogs
  ```
2. Edit `sogs.conf` file with any editor. It's a text file with settings. You can find explanation of each setting in it.
3. [Install Bun](https://bun.sh/) (it's a single command to install)
4. Install dependencies:
  ```
  bun install
  ```
5. Start SOGS:
  ```
  bun start
  ```

It is your job to configure web server to proxy requests to the specified URL. To leave SOGS running, you can use any persisting daemon you like. For example, to use [pm2](https://www.npmjs.com/package/pm2), install it like this: `bun install -g pm2` and to start daemon, use `pm2 start "bun start" --name="My Session Community"` (provide any name you like), also run `pm2 startup` to add pm2 to system autoruns.

## Where is data stored?

Everything is stored inside db.sqlite3 and uploads directory. Periodically copy it in some safe place. 