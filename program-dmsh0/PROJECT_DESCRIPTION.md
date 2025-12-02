# Project Description

**Deployed Frontend URL:** [LINK](https://event-ticketing-solana.vercel.app/)

**Solana Program ID:** 5wkLPJVMaiemo3Nn5QdAgdifjZig3DWUR9pxAGAeCXZJ

## Project Overview

### Description
A decentralized event ticketing platform built on Solana that enables organizers to create events, sell tickets as NFT-like assets, and manage attendee check-ins. The platform eliminates intermediaries by handling all transactions on-chain, including payments through a secure vault system and automated refunds for canceled events. Each ticket is a unique on-chain account that can be transferred between users, checked in at events, and refunded if necessary.

### Key Features
- **Organizer Registration**: Any user can register as an event organizer
- **Event Creation**: Organizers can create events with customizable name, date, price, and ticket supply
- **Ticket Purchasing**: Users buy tickets with SOL, payments go to event vault
- **Ticket Transfers**: Ticket owners can transfer tickets to other wallets
- **Check-In System**: Event organizers can mark tickets as used at the venue entrance
- **Event Cancellation**: Organizers can cancel events, enabling refunds
- **Refund System**: Ticket holders can claim refunds for canceled events

### How to Use the dApp
1. **Connect Wallet** - Connect your Solana wallet (Phantom recommended)
2. **Register as Organizer** (Optional) - Register to create events
3. **Create Event** - Set event details: name, date, price (in SOL), and ticket supply
4. **Browse Events** - View all available events on the home page
5. **Buy Tickets** - Purchase tickets for events you want to attend
6. **My Tickets** - View all tickets you own with their status
7. **Transfer Tickets** - Send tickets to friends or resell them
8. **Check-In** - Organizers can check in attendees at the event entrance
9. **Cancel & Refund** - If an event is canceled, claim your refund

## Program Architecture
The Event Ticketing dApp uses a multi-account architecture with PDAs for deterministic address derivation. The program manages three main account types: Events, Tickets, and an optional Organizer Registry. A vault PDA holds all ticket sale proceeds, enabling secure refunds when events are canceled.

### PDA Usage
The program extensively uses Program Derived Addresses to create deterministic, trustless accounts for all entities.

**PDAs Used:**
- **Event PDA**: Derived from seeds `["event", event_authority, event_id]` - ensures each organizer can create multiple events with unique IDs
- **Ticket PDA**: Derived from seeds `["ticket", event_pda, ticket_id]` - creates unique ticket accounts that are deterministically findable
- **Vault PDA**: Derived from seeds `["vault", event_pda]` - holds all SOL from ticket sales for an event, controlled by the program for refunds
- **Organizer Registry PDA**: Derived from seeds `["organizer", organizer_pubkey]` - marks wallets as registered organizers (optional verification)

### Program Instructions
**Instructions Implemented:**
- **register_organizer**: Creates an OrganizerRegistry account for a wallet, recording registration timestamp
- **initialize_event**: Creates a new Event account with name, date, price, supply, and links it to the organizer
- **mint_ticket**: Purchases a ticket by transferring SOL to the vault and creating a Ticket account for the buyer
- **transfer_ticket**: Transfers ticket ownership from current owner to a new recipient (validates ownership and ticket status)
- **check_in**: Marks a ticket as used by the event authority (only organizer can check in)
- **refund**: Returns ticket price from vault to ticket owner for canceled events (validates event cancellation)
- **cancel_event**: Sets event's canceled flag to true, enabling refunds (only organizer can cancel)

### Account Structure
```rust
#[account]
pub struct Event {
    pub event_authority: Pubkey,  // Organizer's public key
    pub price: u64,                // Ticket price in lamports
    pub supply: u32,               // Total tickets available
    pub sold: u32,                 // Number of tickets sold
    pub canceled: bool,            // Whether event is canceled
    pub event_id: u32,             // Unique event identifier
    pub name: String,              // Event name (max 50 chars)
    pub date: String,              // Event date (max 30 chars)
}

#[account]
pub struct Ticket {
    pub owner: Pubkey,      // Current ticket owner
    pub event: Pubkey,      // Event this ticket belongs to
    pub ticket_id: u32,     // Unique ticket number within event
    pub is_used: bool,      // Whether ticket has been checked in
    pub refunded: bool,     // Whether ticket has been refunded
}

#[account]
pub struct OrganizerRegistry {
    pub organizer: Pubkey,   // Organizer's wallet address
    pub registered_at: i64,  // Registration timestamp
}
```

## Testing

### Test Coverage
Comprehensive test suite covering all seven instructions with both successful operations and security-related error conditions to ensure program reliability and prevent unauthorized access.

**Happy Path Tests:**
- **Register Organizer**: Successfully creates organizer registry account
- **Initialize Event**: Creates event with correct details and initial state
- **Mint Ticket**: Successfully purchases ticket and transfers payment to vault
- **Transfer Ticket**: Transfers ticket ownership between users
- **Check-In**: Event organizer successfully marks ticket as used
- **Cancel Event**: Organizer successfully cancels event
- **Refund**: Ticket owner receives refund for canceled event

**Unhappy Path Tests:**
- **Mint Sold Out**: Fails when trying to buy tickets for sold-out event
- **Mint Canceled Event**: Fails when trying to buy tickets for canceled event
- **Transfer Unauthorized**: Fails when non-owner tries to transfer ticket
- **Transfer Used Ticket**: Fails when trying to transfer already-used ticket
- **Check-In Unauthorized**: Fails when non-organizer tries to check in ticket
- **Check-In Already Used**: Fails when trying to check in same ticket twice
- **Refund Active Event**: Fails when trying to refund ticket for active event
- **Refund Used Ticket**: Fails when trying to refund already-used ticket

### Running Tests
```bash
cd anchor_project
npm install              # install dependencies
anchor build             # build the program
anchor test              # run all tests
```

### Additional Notes for Evaluators

This project implements a complete event ticketing lifecycle on Solana. The main technical challenges were:

1. **Vault Architecture**: Implementing a secure vault PDA that holds funds and can be controlled by the program for refunds required understanding CPI (Cross-Program Invocation) with signer seeds.

2. **State Management**: Ensuring tickets can't be transferred after use, refunds only work for canceled events, and check-ins are restricted to organizers required careful constraint design.

3. **PDA Design**: Using nested PDAs (tickets derived from events) was initially confusing but provides a clean way to organize accounts and find all tickets for an event.

4. **Frontend Integration**: Building an Elm frontend that communicates with Anchor through JavaScript ports required manual Borsh serialization for account data and careful handling of async blockchain operations.

The program prioritizes security with explicit ownership checks, uses PDAs for trustless account derivation, and implements a vault pattern for safe fund management. All edge cases are covered in tests to ensure robustness.
