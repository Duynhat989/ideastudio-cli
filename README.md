# IdeaStudio CLI

## Installation

```bash
npm install -g ideastudio-cli
```

## Run the App

```bash
ideastudio
```

## Full Syntax

```bash
ideastudio [command] [--port <number>] [--no-open]
```

## Commands

```bash
ideastudio
```
Run the release mode (default `start` command).

```bash
ideastudio dev
```
Run development mode (backend + Vite hot reload).

```bash
ideastudio stop
```
Stop the running instance.

```bash
ideastudio doctor
```
Show runtime status.

```bash
ideastudio update
```
Show the CLI update command.

## Options After `--`

```bash
--port <number>
--port=<number>
```
Set the server port (applies to `start`).

```bash
--no-open
```
Do not open the browser automatically after start.

## Examples

```bash
ideastudio --port 1212
ideastudio --port=1212 --no-open
ideastudio stop
```

## Stop the App

Method 1: In the terminal running `ideastudio`, press:

```bash
Ctrl + C
```

Method 2: From any terminal:

```bash
ideastudio stop
```

## Update to the Latest Version

```bash
npm update -g ideastudio-cli
```

After updating, run again:

```bash
ideastudio
```
