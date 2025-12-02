// ============================================================================
// SOLANA/ANCHOR PORTS FOR ELM
// ============================================================================
// This file handles all blockchain interactions for the Elm frontend
// Elm uses "ports" to communicate with JavaScript for side effects

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Buffer } from "buffer";
import idl from "./event_ticketing.json";

// Make Buffer available globally
if (typeof window !== "undefined") {
  window.Buffer = Buffer;
  globalThis.Buffer = Buffer;
}

// ============================================================================
// GLOBAL STATE
// ============================================================================
let program = null;
let provider = null;
let wallet = null;

// ============================================================================
// PDA DERIVATION HELPERS
// ============================================================================
// These functions derive Program Derived Addresses (PDAs)
// PDAs are deterministic addresses controlled by the program

/**
 * Derives the Event PDA
 * Seeds: ["event", event_authority, event_id]
 */
function getEventPda(programId, eventAuthority, eventId) {
  const eventIdBuffer = Buffer.alloc(4);
  eventIdBuffer.writeUInt32LE(eventId);

  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("event"),
      new PublicKey(eventAuthority).toBuffer(),
      eventIdBuffer,
    ],
    programId,
  );

  return pda;
}

/**
 * Derives the Ticket PDA
 * Seeds: ["ticket", event_pda, ticket_id]
 */
function getTicketPda(programId, eventPda, ticketId) {
  const ticketIdBuffer = Buffer.alloc(4);
  ticketIdBuffer.writeUInt32LE(ticketId);

  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("ticket"), new PublicKey(eventPda).toBuffer(), ticketIdBuffer],
    programId,
  );

  return pda;
}

/**
 * Derives the Vault PDA
 * Seeds: ["vault", event_pda]
 */
function getVaultPda(programId, eventPda) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), new PublicKey(eventPda).toBuffer()],
    programId,
  );

  return pda;
}

/**
 * Derives the Organizer Registry PDA
 * Seeds: ["organizer", wallet_pubkey]
 */
function getOrganizerPda(programId, walletPubkey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("organizer"), new PublicKey(walletPubkey).toBuffer()],
    programId,
  );

  return pda;
}

// ============================================================================
// PORT HANDLERS
// ============================================================================
// These functions are called from Elm via ports

/**
 * Connects to a Solana wallet (Phantom or Backpack)
 * This is called when the user clicks "Connect Wallet"
 */
async function connectWallet(app) {
  try {
    // Check for Backpack wallet first, then Phantom
    if (window.backpack && window.backpack.isBackpack) {
      wallet = window.backpack;
      console.log("Using Backpack wallet");
    } else if (window.solana && window.solana.isPhantom) {
      wallet = window.solana;
      console.log("Using Phantom wallet");
    } else if (window.solana) {
      // Generic Solana wallet
      wallet = window.solana;
      console.log("Using generic Solana wallet");
    } else {
      app.ports.walletConnected.send({
        success: false,
        error:
          "No Solana wallet found. Please install Phantom or Backpack wallet.",
      });
      return;
    }

    // Connect to the wallet
    const response = await wallet.connect();
    console.log("Wallet connection response:", response);
    console.log("Wallet object:", wallet);
    console.log("Wallet publicKey:", wallet.publicKey);

    // Get public key early to check format
    let walletPublicKey;
    if (response && response.publicKey) {
      walletPublicKey = response.publicKey;
    } else if (wallet.publicKey) {
      walletPublicKey = wallet.publicKey;
    } else {
      throw new Error("Could not get wallet public key from wallet object");
    }

    console.log("Extracted publicKey:", walletPublicKey);
    console.log("PublicKey type:", typeof walletPublicKey);

    // Convert to PublicKey if it's a string
    if (typeof walletPublicKey === "string") {
      walletPublicKey = new PublicKey(walletPublicKey);
    }

    // Set up Anchor provider
    // Provider connects to the blockchain
    const connection = new anchor.web3.Connection(
      "https://api.devnet.solana.com",
      "confirmed",
    );

    provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    anchor.setProvider(provider);

    // Get the public key string for the response
    let publicKeyStr = walletPublicKey.toString();

    console.log("Public key string:", publicKeyStr);

    console.log("Wallet connected:", publicKeyStr);

    // Initialize the program interface after successful wallet connection
    // Handle both old and new IDL formats
    try {
      console.log("Attempting to initialize program...");
      console.log("IDL object:", idl);
      const programAddress = idl.address || idl.metadata?.address;
      console.log("Program address from IDL:", programAddress);
      if (!programAddress) {
        console.error("Could not find program address in IDL");
        const error = new Error("Program address not found in IDL");
        console.error("Sending error to Elm:", error.message);
        app.ports.walletConnected.send({
          success: false,
          error: error.message,
        });
        return;
      }
      const programId = new PublicKey(programAddress);
      console.log("Program ID PublicKey created:", programId.toString());
      console.log("About to create Anchor Program...");

      // Try creating without the buggy AccountFactory
      const opts = anchor.AnchorProvider.defaultOptions();
      program = new anchor.Program(idl, provider);

      console.log("✅ Program initialized successfully!");
      console.log("Program object:", program);
      console.log("Program methods:", Object.keys(program.methods));
      console.log("Program programId:", program.programId.toString());

      // Now send wallet connected message to Elm AFTER program is initialized
      app.ports.walletConnected.send({
        success: true,
        publicKey: publicKeyStr,
      });
    } catch (programError) {
      console.error("❌ Error initializing program:", programError);
      console.error("Error type:", programError.constructor.name);
      console.error("Error message:", programError.message);
      console.error("Error stack:", programError.stack);
      // Don't fail the wallet connection, but log clearly
      console.warn(
        "⚠️ Program initialization failed, but wallet is connected.",
      );
      console.warn(
        "⚠️ Transaction features will not work until program is initialized.",
      );
      // Don't throw - let wallet stay connected
    }
  } catch (error) {
    console.error("Wallet connection error:", error);
    console.error("Error stack:", error.stack);
    app.ports.walletConnected.send({
      success: false,
      error: error.message || String(error),
    });
  }
}

/**
 * Loads an event account from the blockchain
 */
async function loadEvent(app, data) {
  try {
    const { eventAuthority, eventId } = data;

    // Derive the Event PDA
    const eventPda = getEventPda(program.programId, eventAuthority, eventId);

    // Fetch the account data from the blockchain
    const eventAccount = await program.account.event.fetch(eventPda);

    // Convert to plain JavaScript object and send to Elm
    app.ports.eventLoaded.send({
      success: true,
      event: {
        address: eventPda.toString(),
        eventAuthority: eventAccount.eventAuthority.toString(),
        price: eventAccount.price.toNumber(),
        supply: eventAccount.supply,
        sold: eventAccount.sold,
        canceled: eventAccount.canceled,
        eventId: eventAccount.eventId,
        name: eventAccount.name,
        date: eventAccount.date,
      },
    });
  } catch (error) {
    console.error("Load event error:", error);
    app.ports.eventLoaded.send({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Mints (buys) a ticket for an event
 */
async function buyTicket(app, data) {
  try {
    const { eventAddress } = data;

    const eventPda = new PublicKey(eventAddress);

    // Fetch the event account data manually
    const connection = provider.connection;
    const accountInfo = await connection.getAccountInfo(eventPda);

    if (!accountInfo) {
      throw new Error("Event account not found");
    }

    // Decode manually like we do in loadAllEvents
    const eventData = accountInfo.data;
    const accountData = eventData.slice(8); // Skip discriminator

    let offset = 0;
    offset += 32; // skip event_authority
    offset += 8; // skip price
    offset += 4; // skip supply

    const sold = accountData.readUInt32LE(offset);
    const ticketId = sold; // Next ticket ID

    console.log("Event account info:", {
      eventAddress: eventPda.toString(),
      sold: sold,
      ticketId: ticketId,
    });

    // Derive PDAs
    const ticketPda = getTicketPda(program.programId, eventPda, ticketId);
    const vaultPda = getVaultPda(program.programId, eventPda);

    console.log("Derived addresses:", {
      ticketPda: ticketPda.toString(),
      vaultPda: vaultPda.toString(),
    });

    // Call the mint_ticket instruction
    const tx = await program.methods
      .mintTicket()
      .accounts({
        event: eventPda,
        ticket: ticketPda,
        vault: vaultPda,
        buyer: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Ticket minted:", tx);

    // Send success message to Elm
    app.ports.ticketBought.send({
      success: true,
      signature: tx,
      ticketAddress: ticketPda.toString(),
    });
  } catch (error) {
    console.error("Buy ticket error:", error);
    app.ports.ticketBought.send({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Loads all tickets owned by the connected wallet
 */
async function loadMyTickets(app) {
  try {
    if (!provider || !provider.wallet) {
      throw new Error("Wallet not connected");
    }

    if (!program) {
      throw new Error("Program not initialized");
    }

    console.log(
      "Loading tickets for wallet:",
      provider.wallet.publicKey.toString(),
    );

    // Fetch all program accounts manually
    const programId = program.programId;
    const connection = provider.connection;
    const accounts = await connection.getProgramAccounts(programId);

    console.log(`Found ${accounts.length} total accounts`);

    // Decode and filter Ticket accounts owned by the current wallet
    const ticketsData = [];
    for (const { pubkey, account } of accounts) {
      try {
        // Try to decode as Ticket account
        const data = account.data;

        // Skip if too small to be a Ticket (Ticket is ~78 bytes)
        if (data.length < 70 || data.length > 100) continue;

        // Decode the account data manually
        const accountData = data.slice(8); // Skip discriminator
        let offset = 0;

        const owner = new PublicKey(accountData.slice(offset, offset + 32));
        offset += 32;

        const event = new PublicKey(accountData.slice(offset, offset + 32));
        offset += 32;

        const ticketId = accountData.readUInt32LE(offset);
        offset += 4;

        const isUsed = accountData[offset] === 1;
        offset += 1;

        const refunded = accountData[offset] === 1;

        // For management page, we need all tickets, not just owned by current wallet
        // So we'll load all tickets and let Elm filter them
        {
          // Fetch the event name for this ticket
          let eventName = "Unknown Event";
          try {
            const eventAccountInfo = await connection.getAccountInfo(event);
            if (eventAccountInfo) {
              const eventData = eventAccountInfo.data.slice(8);
              let eventOffset = 32 + 8 + 4 + 4 + 1 + 4; // skip to name
              const nameLen = eventData.readUInt32LE(eventOffset);
              eventOffset += 4;
              eventName = eventData
                .slice(eventOffset, eventOffset + nameLen)
                .toString("utf8");
            }
          } catch (e) {
            console.log("Could not fetch event name:", e.message);
          }

          ticketsData.push({
            address: pubkey.toString(),
            owner: owner.toString(),
            event: event.toString(),
            eventName: eventName,
            ticketId: ticketId,
            isUsed: isUsed,
            refunded: refunded,
          });
        }
      } catch (e) {
        // Not a Ticket account, skip
        continue;
      }
    }

    console.log(`Found ${ticketsData.length} tickets for this wallet`);

    app.ports.myTicketsLoaded.send({
      success: true,
      tickets: ticketsData,
    });
  } catch (error) {
    console.error("Load my tickets error:", error);
    console.error("Error stack:", error.stack);
    app.ports.myTicketsLoaded.send({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Transfers a ticket to a new owner
 */
async function transferTicket(app, data) {
  try {
    const { ticketAddress, newOwner } = data;

    const ticketPda = new PublicKey(ticketAddress);
    const newOwnerPubkey = new PublicKey(newOwner);

    // Call the transfer_ticket instruction
    const tx = await program.methods
      .transferTicket()
      .accounts({
        ticket: ticketPda,
        currentOwner: provider.wallet.publicKey,
        newOwner: newOwnerPubkey,
      })
      .rpc();

    console.log("Ticket transferred:", tx);

    app.ports.ticketTransferred.send({
      success: true,
      signature: tx,
    });
  } catch (error) {
    console.error("Transfer ticket error:", error);
    app.ports.ticketTransferred.send({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Refunds a ticket (admin only - must be event authority)
 */
async function refundTicket(app, data) {
  try {
    const { ticketAddress, eventAddress, ticketOwner } = data;

    const ticketPda = new PublicKey(ticketAddress);
    const eventPda = new PublicKey(eventAddress);
    const vaultPda = getVaultPda(program.programId, eventPda);
    const ticketOwnerPubkey = new PublicKey(ticketOwner);

    // Call the refund instruction
    // Note: event_authority (connected wallet) must be the event organizer
    const tx = await program.methods
      .refund()
      .accounts({
        event: eventPda,
        ticket: ticketPda,
        vault: vaultPda,
        ticketOwner: ticketOwnerPubkey,
        eventAuthority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Ticket refunded:", tx);

    app.ports.ticketRefunded.send({
      success: true,
      signature: tx,
    });
  } catch (error) {
    console.error("Refund ticket error:", error);
    app.ports.ticketRefunded.send({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Checks in a ticket (staff only)
 */
async function checkInTicket(app, data) {
  try {
    const { ticketAddress } = data;

    const ticketPda = new PublicKey(ticketAddress);

    // Fetch the ticket account manually to get the event address
    const connection = provider.connection;
    const ticketAccountInfo = await connection.getAccountInfo(ticketPda);

    if (!ticketAccountInfo) {
      throw new Error("Ticket account not found");
    }

    // Decode manually to get event address
    const ticketData = ticketAccountInfo.data.slice(8); // Skip discriminator
    let offset = 0;
    offset += 32; // skip owner
    const eventPda = new PublicKey(ticketData.slice(offset, offset + 32));

    // Call the check_in instruction
    const tx = await program.methods
      .checkIn()
      .accounts({
        event: eventPda,
        ticket: ticketPda,
        eventAuthority: provider.wallet.publicKey,
      })
      .rpc();

    console.log("Ticket checked in:", tx);

    app.ports.ticketCheckedIn.send({
      success: true,
      signature: tx,
    });
  } catch (error) {
    console.error("Check-in error:", error);
    app.ports.ticketCheckedIn.send({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Creates a new event
 */
async function createEvent(app, data) {
  try {
    if (!program) {
      throw new Error("Program not initialized. Please reconnect your wallet.");
    }

    const { name, date, price, supply } = data;

    // Generate a unique event ID based on current timestamp
    // Using milliseconds since epoch, then taking last 9 digits to keep it within u32 range
    const eventIdNum = Math.floor(Date.now() / 1000) % 1000000000;

    // Parse inputs
    // Price input is in SOL, convert to lamports
    const priceInSol = parseFloat(price);
    const priceNum = new anchor.BN(Math.floor(priceInSol * LAMPORTS_PER_SOL));
    const supplyNum = parseInt(supply);

    console.log("Creating event with:", {
      eventId: eventIdNum,
      priceInSol: priceInSol,
      priceInLamports: priceNum.toString(),
      supply: supplyNum,
    });

    // Derive event PDA
    const eventPda = getEventPda(
      program.programId,
      provider.wallet.publicKey,
      eventIdNum,
    );

    console.log("Creating event:", {
      eventIdNum,
      name,
      date,
      priceNum: priceNum.toString(),
      supplyNum,
    });

    // Call initialize_event instruction
    const tx = await program.methods
      .initializeEvent(eventIdNum, priceNum, supplyNum, name, date)
      .accounts({
        event: eventPda,
        eventAuthority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Event created:", tx);

    app.ports.eventCreated.send({
      success: true,
      signature: tx,
    });
  } catch (error) {
    console.error("Create event error:", error);
    app.ports.eventCreated.send({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Loads all events from the blockchain
 */
async function loadAllEvents(app) {
  try {
    if (!program) {
      throw new Error("Program not initialized");
    }

    console.log("Loading all events from blockchain...");
    console.log("Program account:", program.account);

    // Since program.account is undefined, we need to fetch accounts manually
    // Get all accounts owned by the program
    const programId = program.programId;
    const connection = provider.connection;

    // Fetch all program accounts
    const accounts = await connection.getProgramAccounts(programId);

    console.log(`Found ${accounts.length} accounts`);

    // Decode and filter Event accounts
    const eventsData = [];
    for (const { pubkey, account } of accounts) {
      try {
        // Try to decode as Event account
        // Event discriminator is the first 8 bytes
        const data = account.data;

        console.log(`Account ${pubkey.toString()}: size=${data.length}`);

        // Skip if size doesn't match Event (Events are ~149 bytes)
        if (data.length < 140 || data.length > 200) {
          console.log("  -> Size doesn't match Event");
          continue;
        }

        // Decode the account data manually using borsh layout
        console.log("  -> Attempting to decode as Event manually...");

        // Skip the 8-byte discriminator
        const accountData = data.slice(8);

        // Manual decode based on Event struct
        let offset = 0;
        const eventAuthority = new PublicKey(
          accountData.slice(offset, offset + 32),
        );
        offset += 32;

        const price = new anchor.BN(
          accountData.slice(offset, offset + 8),
          "le",
        );
        offset += 8;

        const supply = accountData.readUInt32LE(offset);
        offset += 4;

        const sold = accountData.readUInt32LE(offset);
        offset += 4;

        const canceled = accountData[offset] === 1;
        offset += 1;

        const eventId = accountData.readUInt32LE(offset);
        offset += 4;

        const nameLen = accountData.readUInt32LE(offset);
        offset += 4;
        const name = accountData
          .slice(offset, offset + nameLen)
          .toString("utf8");
        offset += nameLen;

        const dateLen = accountData.readUInt32LE(offset);
        offset += 4;
        const date = accountData
          .slice(offset, offset + dateLen)
          .toString("utf8");

        const decoded = {
          eventAuthority,
          price,
          supply,
          sold,
          canceled,
          eventId,
          name,
          date,
        };

        console.log("  -> Successfully decoded Event:", decoded.name);

        eventsData.push({
          address: pubkey.toString(),
          eventAuthority: decoded.eventAuthority.toString(),
          price: decoded.price.toNumber(),
          supply: decoded.supply,
          sold: decoded.sold,
          canceled: decoded.canceled,
          eventId: decoded.eventId,
          name: decoded.name,
          date: decoded.date,
        });
      } catch (e) {
        // Not an Event account, skip
        console.log(`  -> Not an Event: ${e.message}`);
        continue;
      }
    }

    console.log(`Found ${eventsData.length} events`);

    app.ports.allEventsLoaded.send({
      success: true,
      events: eventsData,
    });
  } catch (error) {
    console.error("Load events error:", error);
    console.error("Error stack:", error.stack);
    app.ports.allEventsLoaded.send({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Cancels an event (admin only - must be event authority)
 */
async function cancelEvent(app, data) {
  try {
    const { eventAddress } = data;

    const eventPda = new PublicKey(eventAddress);

    // Call the cancel_event instruction
    const tx = await program.methods
      .cancelEvent()
      .accounts({
        event: eventPda,
        eventAuthority: provider.wallet.publicKey,
      })
      .rpc();

    console.log("Event canceled:", tx);

    app.ports.eventCanceled.send({
      success: true,
      signature: tx,
    });
  } catch (error) {
    console.error("Cancel event error:", error);
    app.ports.eventCanceled.send({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Checks if the connected wallet is registered as an organizer
 */
async function checkOrganizerStatus(app) {
  try {
    if (!provider || !provider.wallet) {
      throw new Error("Wallet not connected");
    }

    if (!program) {
      throw new Error("Program not initialized");
    }

    const organizerPda = getOrganizerPda(
      program.programId,
      provider.wallet.publicKey,
    );

    console.log("Checking organizer status for PDA:", organizerPda.toString());

    // Try to fetch the organizer registry account
    const connection = provider.connection;
    const accountInfo = await connection.getAccountInfo(organizerPda);

    const isOrganizer = accountInfo !== null;

    console.log("Organizer status:", isOrganizer);

    app.ports.organizerStatusChecked.send({
      success: true,
      isOrganizer: isOrganizer,
    });
  } catch (error) {
    console.error("Check organizer status error:", error);
    app.ports.organizerStatusChecked.send({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Registers the connected wallet as an organizer
 */
async function registerOrganizer(app) {
  try {
    if (!provider || !provider.wallet) {
      throw new Error("Wallet not connected");
    }

    if (!program) {
      throw new Error("Program not initialized. Please reconnect your wallet.");
    }

    const organizerPda = getOrganizerPda(
      program.programId,
      provider.wallet.publicKey,
    );

    console.log("Registering organizer with PDA:", organizerPda.toString());

    // Call register_organizer instruction
    const tx = await program.methods
      .registerOrganizer()
      .accounts({
        organizerRegistry: organizerPda,
        organizer: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Organizer registered:", tx);

    app.ports.organizerRegistered.send({
      success: true,
      signature: tx,
    });
  } catch (error) {
    console.error("Register organizer error:", error);
    app.ports.organizerRegistered.send({
      success: false,
      error: error.message,
    });
  }
}

// ============================================================================
// INITIALIZE PORTS
// ============================================================================
// This function is called from index.html to wire up all the ports

// Test function to check program status
window.testProgramStatus = function () {
  console.log("=== Program Status Check ===");
  console.log("Program initialized:", program !== null);
  console.log("Provider initialized:", provider !== null);
  console.log("Wallet initialized:", wallet !== null);
  if (program) {
    console.log("Program ID:", program.programId?.toString());
    console.log(
      "Program methods available:",
      Object.keys(program.methods || {}),
    );
  }
  if (provider) {
    console.log("Provider wallet:", provider.wallet?.publicKey?.toString());
  }
  if (wallet) {
    console.log("Wallet public key:", wallet.publicKey?.toString());
  }
  console.log("=========================");
};

export function initPorts(app) {
  // Outgoing ports (Elm -> JavaScript)
  // These are triggered by Elm and handled here

  app.ports.connectWalletPort.subscribe(() => {
    connectWallet(app);
  });

  app.ports.createEventPort.subscribe((data) => {
    createEvent(app, data);
  });

  app.ports.loadAllEventsPort.subscribe(() => {
    loadAllEvents(app);
  });

  app.ports.buyTicketPort.subscribe((data) => {
    buyTicket(app, data);
  });

  app.ports.loadMyTicketsPort.subscribe(() => {
    loadMyTickets(app);
  });

  app.ports.transferTicketPort.subscribe((data) => {
    transferTicket(app, data);
  });

  app.ports.refundTicketPort.subscribe((data) => {
    refundTicket(app, data);
  });

  app.ports.checkInTicketPort.subscribe((data) => {
    checkInTicket(app, data);
  });

  app.ports.cancelEventPort.subscribe((data) => {
    cancelEvent(app, data);
  });

  app.ports.checkOrganizerStatusPort.subscribe(() => {
    checkOrganizerStatus(app);
  });

  app.ports.registerOrganizerPort.subscribe(() => {
    registerOrganizer(app);
  });

  console.log("Ports initialized");
}
