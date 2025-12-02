# Event Ticketing - Anchor Program

Solana smart contract for decentralized event ticketing platform.

## Setup

```bash
npm install
anchor build
anchor test
```

## Deploy

```bash
anchor deploy --provider.cluster devnet
```

## Program ID

```
CNZ9yfQwrD6N3EkhxRPFjptuHu4Z71ufrTte8zG5TkwY
```

## Instructions

- `register_organizer` - Register as event organizer
- `initialize_event` - Create new event
- `mint_ticket` - Buy ticket for event
- `transfer_ticket` - Transfer ticket to another user
- `check_in` - Mark ticket as used (organizer only)
- `refund` - Refund ticket for canceled event
- `cancel_event` - Cancel event (organizer only)
