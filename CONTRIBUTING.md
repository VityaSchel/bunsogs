# Contributing to Bunsogs

## Running source code

1. Clone source code
  ```
  git clone https://github.com/VityaSchel/bunsogs
  ```
1. Optionally edit `sogs.conf` file with any editor.
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
5. Finally, start your SOGS:
```
bun start
```
Use this command whenever you want to start server, others are just preparations. Keep in mind that you have to be in the bunsogs directory.

First time you run it, bunsogs will create key_x25519 and db.sqlite3, after that you can use bunsogs-cli to add rooms and configure sogs.