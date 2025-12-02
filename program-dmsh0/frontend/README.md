# Event Ticketing - Frontend

Elm-based frontend for the Event Ticketing dApp.

## Setup

```bash
elm make src/Main.elm --output=elm.js
```

## Run Locally

```bash
python3 -m http.server 8080
```

Open http://localhost:8080 in your browser.

## Features

- Connect Solana wallet (Phantom)
- Browse events
- Buy tickets
- Transfer tickets
- View owned tickets
- Check-in tickets (organizers)
- Manage events (organizers)

## Configuration

The program ID is configured in `ports.js`. Make sure it matches your deployed program.
