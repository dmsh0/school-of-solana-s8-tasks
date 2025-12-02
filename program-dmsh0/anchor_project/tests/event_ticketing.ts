// ============================================================================
// EVENT TICKETING PROGRAM TESTS
// ============================================================================
// This file contains comprehensive tests for all instructions in the program
// Each instruction has happy path (success) and unhappy path (failure) tests

// Import Anchor framework and testing utilities
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EventTicketing } from "../target/types/event_ticketing";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";

// ============================================================================
// TEST SUITE SETUP
// ============================================================================
describe("event_ticketing", () => {
  // Configure the client to use the local cluster (localhost)
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Get the program interface - this allows us to call instructions
  const program = anchor.workspace.EventTicketing as Program<EventTicketing>;

  // Create test keypairs (these are like test accounts with private keys)
  const eventAuthority = Keypair.generate(); // Event organizer
  const buyer1 = Keypair.generate(); // First ticket buyer
  const buyer2 = Keypair.generate(); // Second ticket buyer
  const buyer3 = Keypair.generate(); // Third ticket buyer

  // Define test event parameters
  const eventId = 1; // Unique ID for this event
  const ticketPrice = new anchor.BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL per ticket
  const ticketSupply = 3; // Only 3 tickets available
  const eventName = "Bitcoin Conference 2024";
  const eventDate = "2024-12-31T19:00:00Z";

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  // These functions help us derive PDAs and perform common operations

  /**
   * Derives the Event PDA address
   * PDA = Program Derived Address (deterministic address owned by the program)
   * Seeds: ["event", event_authority, event_id]
   */
  function getEventPda(authority: PublicKey, id: number): [PublicKey, number] {
    // Convert event_id to bytes (little-endian 4-byte array)
    const eventIdBuffer = Buffer.alloc(4);
    eventIdBuffer.writeUInt32LE(id);

    // Find the PDA using the seeds
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("event"), // seed 1: literal string "event"
        authority.toBuffer(), // seed 2: event authority public key
        eventIdBuffer, // seed 3: event_id as bytes
      ],
      program.programId // The program that owns this PDA
    );
  }

  /**
   * Derives the Ticket PDA address
   * Seeds: ["ticket", event_pda, ticket_id]
   */
  function getTicketPda(
    eventPda: PublicKey,
    ticketId: number
  ): [PublicKey, number] {
    const ticketIdBuffer = Buffer.alloc(4);
    ticketIdBuffer.writeUInt32LE(ticketId);

    return PublicKey.findProgramAddressSync(
      [Buffer.from("ticket"), eventPda.toBuffer(), ticketIdBuffer],
      program.programId
    );
  }

  /**
   * Derives the Vault PDA address (holds SOL from ticket sales)
   * Seeds: ["vault", event_pda]
   */
  function getVaultPda(eventPda: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), eventPda.toBuffer()],
      program.programId
    );
  }

  /**
   * Airdrops SOL to an account for testing
   * Needed because test accounts start with 0 SOL
   */
  async function airdrop(publicKey: PublicKey, amount: number) {
    const signature = await provider.connection.requestAirdrop(
      publicKey,
      amount * LAMPORTS_PER_SOL
    );
    // Wait for the airdrop transaction to be confirmed
    await provider.connection.confirmTransaction(signature);
  }

  // ============================================================================
  // SETUP: Fund test accounts with SOL
  // ============================================================================
  before(async () => {
    // Give each test account some SOL to pay for transactions
    await airdrop(eventAuthority.publicKey, 10);
    await airdrop(buyer1.publicKey, 10);
    await airdrop(buyer2.publicKey, 10);
    await airdrop(buyer3.publicKey, 10);
  });

  // ============================================================================
  // TEST GROUP: register_organizer instruction
  // ============================================================================
  describe("register_organizer", () => {
    /**
     * Derives the Organizer Registry PDA address
     * Seeds: ["organizer", organizer_pubkey]
     */
    function getOrganizerPda(organizer: PublicKey): [PublicKey, number] {
      return PublicKey.findProgramAddressSync(
        [Buffer.from("organizer"), organizer.toBuffer()],
        program.programId
      );
    }

    // HAPPY PATH: Successfully register an organizer
    it("Successfully registers an organizer", async () => {
      const [organizerPda] = getOrganizerPda(eventAuthority.publicKey);

      // Call the register_organizer instruction
      const tx = await program.methods
        .registerOrganizer()
        .accounts({
          organizerRegistry: organizerPda,
          organizer: eventAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([eventAuthority])
        .rpc();

      console.log("Organizer registered:", tx);

      // Fetch the created OrganizerRegistry account
      const organizerAccount = await program.account.organizerRegistry.fetch(
        organizerPda
      );

      // ASSERTIONS: Verify the account was created with correct data
      expect(organizerAccount.organizer.toString()).to.equal(
        eventAuthority.publicKey.toString()
      );
      expect(organizerAccount.registeredAt.toNumber()).to.be.greaterThan(0);
    });

    // UNHAPPY PATH: Try to register the same organizer twice
    it("Fails to register organizer twice", async () => {
      const [organizerPda] = getOrganizerPda(eventAuthority.publicKey);

      try {
        // Try to register the same organizer again (should fail)
        await program.methods
          .registerOrganizer()
          .accounts({
            organizerRegistry: organizerPda,
            organizer: eventAuthority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([eventAuthority])
          .rpc();

        // If we get here, the test should fail
        expect.fail("Should have thrown an error");
      } catch (error) {
        // Expected to fail because account already exists
        expect(error).to.exist;
        console.log("Expected error: Organizer already registered");
      }
    });

    // UNHAPPY PATH: Different user can register as organizer
    it("Successfully registers a different organizer", async () => {
      const [buyer1OrganizerPda] = getOrganizerPda(buyer1.publicKey);

      // buyer1 can register as their own organizer
      await program.methods
        .registerOrganizer()
        .accounts({
          organizerRegistry: buyer1OrganizerPda,
          organizer: buyer1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer1])
        .rpc();

      // Fetch and verify
      const organizerAccount = await program.account.organizerRegistry.fetch(
        buyer1OrganizerPda
      );

      expect(organizerAccount.organizer.toString()).to.equal(
        buyer1.publicKey.toString()
      );
    });
  });

  // ============================================================================
  // TEST GROUP: initialize_event instruction
  // ============================================================================
  describe("initialize_event", () => {
    // HAPPY PATH: Successfully create an event
    it("Successfully initializes an event", async () => {
      // Derive the Event PDA
      const [eventPda] = getEventPda(eventAuthority.publicKey, eventId);

      // Call the initialize_event instruction
      const tx = await program.methods
        .initializeEvent(
          eventId,
          ticketPrice,
          ticketSupply,
          eventName,
          eventDate
        )
        .accounts({
          event: eventPda,
          eventAuthority: eventAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([eventAuthority]) // eventAuthority must sign
        .rpc();

      console.log("Event initialized:", tx);

      // Fetch the created Event account from the blockchain
      const eventAccount = await program.account.event.fetch(eventPda);

      // ASSERTIONS: Verify the account was created with correct data
      expect(eventAccount.eventAuthority.toString()).to.equal(
        eventAuthority.publicKey.toString()
      );
      expect(eventAccount.price.toNumber()).to.equal(ticketPrice.toNumber());
      expect(eventAccount.supply).to.equal(ticketSupply);
      expect(eventAccount.sold).to.equal(0); // No tickets sold yet
      expect(eventAccount.canceled).to.be.false; // Event is active
      expect(eventAccount.eventId).to.equal(eventId);
      expect(eventAccount.name).to.equal(eventName);
      expect(eventAccount.date).to.equal(eventDate);
    });

    // UNHAPPY PATH: Try to create duplicate event
    it("Fails to initialize duplicate event", async () => {
      const [eventPda] = getEventPda(eventAuthority.publicKey, eventId);

      try {
        // Try to create the same event again (should fail)
        await program.methods
          .initializeEvent(
            eventId, // Same ID as before
            ticketPrice,
            ticketSupply,
            "Duplicate Event",
            eventDate
          )
          .accounts({
            event: eventPda,
            eventAuthority: eventAuthority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([eventAuthority])
          .rpc();

        // If we get here, the test should fail
        expect.fail("Should have thrown an error");
      } catch (error) {
        // Expected to fail because account already exists
        expect(error).to.exist;
      }
    });

    // UNHAPPY PATH: Event name too long
    it("Fails with event name too long", async () => {
      const longEventId = 999;
      const [eventPda] = getEventPda(eventAuthority.publicKey, longEventId);

      // Create a name that exceeds MAX_NAME_LEN (50 characters)
      const tooLongName = "A".repeat(51);

      try {
        await program.methods
          .initializeEvent(
            longEventId,
            ticketPrice,
            ticketSupply,
            tooLongName,
            eventDate
          )
          .accounts({
            event: eventPda,
            eventAuthority: eventAuthority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([eventAuthority])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Expected to fail with NameTooLong error
        expect(error.toString()).to.include("NameTooLong");
      }
    });
  });

  // ============================================================================
  // TEST GROUP: mint_ticket instruction
  // ============================================================================
  describe("mint_ticket", () => {
    // HAPPY PATH: Successfully buy a ticket
    it("Successfully mints a ticket", async () => {
      const [eventPda] = getEventPda(eventAuthority.publicKey, eventId);
      const [ticketPda] = getTicketPda(eventPda, 0); // ticket_id = 0 (first ticket)
      const [vaultPda] = getVaultPda(eventPda);

      // Get vault balance before minting
      const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);

      // Call the mint_ticket instruction
      const tx = await program.methods
        .mintTicket()
        .accounts({
          event: eventPda,
          ticket: ticketPda,
          vault: vaultPda,
          buyer: buyer1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer1]) // buyer1 must sign to pay
        .rpc();

      console.log("Ticket minted:", tx);

      // Fetch the created Ticket account
      const ticketAccount = await program.account.ticket.fetch(ticketPda);

      // ASSERTIONS: Verify ticket was created correctly
      expect(ticketAccount.owner.toString()).to.equal(
        buyer1.publicKey.toString()
      );
      expect(ticketAccount.event.toString()).to.equal(eventPda.toString());
      expect(ticketAccount.ticketId).to.equal(0);
      expect(ticketAccount.isUsed).to.be.false;
      expect(ticketAccount.refunded).to.be.false;

      // Verify the event's sold counter was incremented
      const eventAccount = await program.account.event.fetch(eventPda);
      expect(eventAccount.sold).to.equal(1);

      // Verify payment was transferred to vault
      const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);
      expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(
        ticketPrice.toNumber()
      );
    });

    // HAPPY PATH: Mint second ticket
    it("Successfully mints a second ticket", async () => {
      const [eventPda] = getEventPda(eventAuthority.publicKey, eventId);
      const [ticketPda] = getTicketPda(eventPda, 1); // ticket_id = 1 (second ticket)
      const [vaultPda] = getVaultPda(eventPda);

      await program.methods
        .mintTicket()
        .accounts({
          event: eventPda,
          ticket: ticketPda,
          vault: vaultPda,
          buyer: buyer2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer2])
        .rpc();

      // Verify sold counter is now 2
      const eventAccount = await program.account.event.fetch(eventPda);
      expect(eventAccount.sold).to.equal(2);
    });

    // HAPPY PATH: Mint third and final ticket
    it("Successfully mints the last ticket", async () => {
      const [eventPda] = getEventPda(eventAuthority.publicKey, eventId);
      const [ticketPda] = getTicketPda(eventPda, 2); // ticket_id = 2 (third ticket)
      const [vaultPda] = getVaultPda(eventPda);

      await program.methods
        .mintTicket()
        .accounts({
          event: eventPda,
          ticket: ticketPda,
          vault: vaultPda,
          buyer: buyer3.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer3])
        .rpc();

      // Verify sold counter is now 3 (sold out!)
      const eventAccount = await program.account.event.fetch(eventPda);
      expect(eventAccount.sold).to.equal(3);
    });

    // UNHAPPY PATH: Try to mint when sold out
    it("Fails to mint ticket when sold out", async () => {
      const [eventPda] = getEventPda(eventAuthority.publicKey, eventId);
      const [ticketPda] = getTicketPda(eventPda, 3); // Would be ticket #4
      const [vaultPda] = getVaultPda(eventPda);

      // Create another buyer
      const buyer4 = Keypair.generate();
      await airdrop(buyer4.publicKey, 10);

      try {
        await program.methods
          .mintTicket()
          .accounts({
            event: eventPda,
            ticket: ticketPda,
            vault: vaultPda,
            buyer: buyer4.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer4])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Expected to fail with EventSoldOut error
        expect(error.toString()).to.include("EventSoldOut");
      }
    });

    // UNHAPPY PATH: Try to mint for canceled event
    it("Fails to mint ticket for canceled event", async () => {
      // Create a new event that we can cancel
      const canceledEventId = 2;
      const [canceledEventPda] = getEventPda(
        eventAuthority.publicKey,
        canceledEventId
      );

      // Initialize the event
      await program.methods
        .initializeEvent(
          canceledEventId,
          ticketPrice,
          5,
          "Canceled Event",
          eventDate
        )
        .accounts({
          event: canceledEventPda,
          eventAuthority: eventAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([eventAuthority])
        .rpc();

      // Cancel the event using the cancel_event instruction
      await program.methods
        .cancelEvent()
        .accounts({
          event: canceledEventPda,
          eventAuthority: eventAuthority.publicKey,
        })
        .signers([eventAuthority])
        .rpc();

      // Verify the event is canceled
      const eventAccount = await program.account.event.fetch(canceledEventPda);
      expect(eventAccount.canceled).to.be.true;

      // Now try to mint a ticket for the canceled event
      const [ticketPda] = getTicketPda(canceledEventPda, 0);
      const [vaultPda] = getVaultPda(canceledEventPda);

      const testBuyer = Keypair.generate();
      await airdrop(testBuyer.publicKey, 10);

      try {
        await program.methods
          .mintTicket()
          .accounts({
            event: canceledEventPda,
            ticket: ticketPda,
            vault: vaultPda,
            buyer: testBuyer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([testBuyer])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Expected to fail with EventCanceled error
        expect(error.toString()).to.include("EventCanceled");
        console.log("Expected error: Cannot mint ticket for canceled event");
      }
    });
  });

  // ============================================================================
  // TEST GROUP: transfer_ticket instruction
  // ============================================================================
  describe("transfer_ticket", () => {
    // HAPPY PATH: Successfully transfer a ticket
    it("Successfully transfers a ticket", async () => {
      const [eventPda] = getEventPda(eventAuthority.publicKey, eventId);
      const [ticketPda] = getTicketPda(eventPda, 0); // buyer1's ticket

      // Create a new recipient
      const recipient = Keypair.generate();

      // Transfer ticket from buyer1 to recipient
      const tx = await program.methods
        .transferTicket()
        .accounts({
          ticket: ticketPda,
          currentOwner: buyer1.publicKey,
          newOwner: recipient.publicKey,
        })
        .signers([buyer1]) // buyer1 must sign to authorize transfer
        .rpc();

      console.log("Ticket transferred:", tx);

      // Fetch the ticket and verify owner changed
      const ticketAccount = await program.account.ticket.fetch(ticketPda);
      expect(ticketAccount.owner.toString()).to.equal(
        recipient.publicKey.toString()
      );
    });

    // UNHAPPY PATH: Try to transfer someone else's ticket
    it("Fails to transfer ticket without authorization", async () => {
      const [eventPda] = getEventPda(eventAuthority.publicKey, eventId);
      const [ticketPda] = getTicketPda(eventPda, 1); // buyer2's ticket

      // buyer3 tries to transfer buyer2's ticket
      const recipient = Keypair.generate();

      try {
        await program.methods
          .transferTicket()
          .accounts({
            ticket: ticketPda,
            currentOwner: buyer3.publicKey, // Wrong owner!
            newOwner: recipient.publicKey,
          })
          .signers([buyer3])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Expected to fail with UnauthorizedTransfer error
        expect(error.toString()).to.include("UnauthorizedTransfer");
      }
    });

    // UNHAPPY PATH: Try to transfer a used ticket
    it("Fails to transfer a used ticket", async () => {
      const [eventPda] = getEventPda(eventAuthority.publicKey, eventId);
      const [ticketPda] = getTicketPda(eventPda, 1); // buyer2's ticket

      // First, check in the ticket (mark as used)
      await program.methods
        .checkIn()
        .accounts({
          event: eventPda,
          ticket: ticketPda,
          eventAuthority: eventAuthority.publicKey,
        })
        .signers([eventAuthority])
        .rpc();

      // Now try to transfer the used ticket
      const recipient = Keypair.generate();

      try {
        await program.methods
          .transferTicket()
          .accounts({
            ticket: ticketPda,
            currentOwner: buyer2.publicKey,
            newOwner: recipient.publicKey,
          })
          .signers([buyer2])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Expected to fail with TicketAlreadyUsed error
        expect(error.toString()).to.include("TicketAlreadyUsed");
      }
    });
  });

  // ============================================================================
  // TEST GROUP: check_in instruction
  // ============================================================================
  describe("check_in", () => {
    // HAPPY PATH: Successfully check in a ticket
    it("Successfully checks in a ticket", async () => {
      const [eventPda] = getEventPda(eventAuthority.publicKey, eventId);
      const [ticketPda] = getTicketPda(eventPda, 2); // buyer3's ticket

      // Check in the ticket
      const tx = await program.methods
        .checkIn()
        .accounts({
          event: eventPda,
          ticket: ticketPda,
          eventAuthority: eventAuthority.publicKey,
        })
        .signers([eventAuthority]) // Only event authority can check in
        .rpc();

      console.log("Ticket checked in:", tx);

      // Fetch the ticket and verify it's marked as used
      const ticketAccount = await program.account.ticket.fetch(ticketPda);
      expect(ticketAccount.isUsed).to.be.true;
    });

    // UNHAPPY PATH: Try to check in twice
    it("Fails to check in a ticket twice", async () => {
      const [eventPda] = getEventPda(eventAuthority.publicKey, eventId);
      const [ticketPda] = getTicketPda(eventPda, 2); // Already checked in above

      try {
        await program.methods
          .checkIn()
          .accounts({
            event: eventPda,
            ticket: ticketPda,
            eventAuthority: eventAuthority.publicKey,
          })
          .signers([eventAuthority])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Expected to fail with AlreadyCheckedIn error
        expect(error.toString()).to.include("AlreadyCheckedIn");
      }
    });

    // UNHAPPY PATH: Unauthorized person tries to check in
    it("Fails when non-authority tries to check in", async () => {
      // Create a new event and ticket for this test
      const unauthorizedEventId = 3;
      const [unauthorizedEventPda] = getEventPda(
        eventAuthority.publicKey,
        unauthorizedEventId
      );

      await program.methods
        .initializeEvent(
          unauthorizedEventId,
          ticketPrice,
          5,
          "Unauthorized Test Event",
          eventDate
        )
        .accounts({
          event: unauthorizedEventPda,
          eventAuthority: eventAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([eventAuthority])
        .rpc();

      const [ticketPda] = getTicketPda(unauthorizedEventPda, 0);
      const [vaultPda] = getVaultPda(unauthorizedEventPda);

      // Mint a ticket
      await program.methods
        .mintTicket()
        .accounts({
          event: unauthorizedEventPda,
          ticket: ticketPda,
          vault: vaultPda,
          buyer: buyer1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer1])
        .rpc();

      // Try to check in with buyer1 (not the event authority)
      try {
        await program.methods
          .checkIn()
          .accounts({
            event: unauthorizedEventPda,
            ticket: ticketPda,
            eventAuthority: buyer1.publicKey, // Wrong authority!
          })
          .signers([buyer1])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Expected to fail with UnauthorizedCheckIn error
        expect(error.toString()).to.include("UnauthorizedCheckIn");
      }
    });
  });

  // ============================================================================
  // TEST GROUP: cancel_event instruction
  // ============================================================================
  describe("cancel_event", () => {
    let cancelTestEventId: number;
    let cancelTestEventPda: PublicKey;

    before(async () => {
      cancelTestEventId = 99;
      [cancelTestEventPda] = getEventPda(
        eventAuthority.publicKey,
        cancelTestEventId
      );

      // Initialize event
      await program.methods
        .initializeEvent(
          cancelTestEventId,
          ticketPrice,
          5,
          "Event to be Canceled",
          eventDate
        )
        .accounts({
          event: cancelTestEventPda,
          eventAuthority: eventAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([eventAuthority])
        .rpc();
    });

    // HAPPY PATH: Cancel an event as event authority
    it("Successfully cancels an event", async () => {
      await program.methods
        .cancelEvent()
        .accounts({
          event: cancelTestEventPda,
          eventAuthority: eventAuthority.publicKey,
        })
        .signers([eventAuthority])
        .rpc();

      // Verify the event is now canceled
      const eventAccount = await program.account.event.fetch(
        cancelTestEventPda
      );
      expect(eventAccount.canceled).to.be.true;
    });

    // UNHAPPY PATH: Try to cancel event as non-authority
    it("Fails to cancel event as non-authority", async () => {
      const anotherEventId = 98;
      const [anotherEventPda] = getEventPda(
        eventAuthority.publicKey,
        anotherEventId
      );

      await program.methods
        .initializeEvent(
          anotherEventId,
          ticketPrice,
          5,
          "Another Event",
          eventDate
        )
        .accounts({
          event: anotherEventPda,
          eventAuthority: eventAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([eventAuthority])
        .rpc();

      try {
        await program.methods
          .cancelEvent()
          .accounts({
            event: anotherEventPda,
            eventAuthority: buyer1.publicKey, // Wrong authority
          })
          .signers([buyer1])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Expected to fail due to constraint violation
        expect(error).to.exist;
      }
    });
  });

  // ============================================================================
  // TEST GROUP: refund instruction
  // ============================================================================
  describe("refund", () => {
    let refundEventId: number;
    let refundEventPda: PublicKey;
    let refundTicketPda: PublicKey;
    let refundVaultPda: PublicKey;

    // Setup: Create an event with a ticket for refund tests
    before(async () => {
      refundEventId = 100;
      [refundEventPda] = getEventPda(eventAuthority.publicKey, refundEventId);

      // Initialize event
      await program.methods
        .initializeEvent(
          refundEventId,
          ticketPrice,
          5,
          "Refundable Event",
          eventDate
        )
        .accounts({
          event: refundEventPda,
          eventAuthority: eventAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([eventAuthority])
        .rpc();

      // Mint a ticket for buyer1
      [refundTicketPda] = getTicketPda(refundEventPda, 0);
      [refundVaultPda] = getVaultPda(refundEventPda);

      await program.methods
        .mintTicket()
        .accounts({
          event: refundEventPda,
          ticket: refundTicketPda,
          vault: refundVaultPda,
          buyer: buyer1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer1])
        .rpc();
    });

    // HAPPY PATH: Event authority issues a refund
    it("Successfully refunds a ticket (event authority)", async () => {
      const buyer1BalanceBefore = await provider.connection.getBalance(
        buyer1.publicKey
      );

      await program.methods
        .refund()
        .accounts({
          event: refundEventPda,
          ticket: refundTicketPda,
          vault: refundVaultPda,
          ticketOwner: buyer1.publicKey,
          eventAuthority: eventAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([eventAuthority]) // Event authority signs, not ticket owner
        .rpc();

      // Verify the ticket is marked as refunded
      const ticketAccount = await program.account.ticket.fetch(refundTicketPda);
      expect(ticketAccount.refunded).to.be.true;

      // Verify buyer1 received their refund
      const buyer1BalanceAfter = await provider.connection.getBalance(
        buyer1.publicKey
      );
      expect(buyer1BalanceAfter).to.be.greaterThan(buyer1BalanceBefore);
    });

    // UNHAPPY PATH: Ticket owner tries to refund (should fail - only admin can refund)
    it("Fails when ticket owner tries to refund themselves", async () => {
      // Create another event and ticket
      const selfRefundEventId = 102;
      const [selfRefundEventPda] = getEventPda(
        eventAuthority.publicKey,
        selfRefundEventId
      );

      await program.methods
        .initializeEvent(
          selfRefundEventId,
          ticketPrice,
          5,
          "Self Refund Test Event",
          eventDate
        )
        .accounts({
          event: selfRefundEventPda,
          eventAuthority: eventAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([eventAuthority])
        .rpc();

      const [selfRefundTicketPda] = getTicketPda(selfRefundEventPda, 0);
      const [selfRefundVaultPda] = getVaultPda(selfRefundEventPda);

      await program.methods
        .mintTicket()
        .accounts({
          event: selfRefundEventPda,
          ticket: selfRefundTicketPda,
          vault: selfRefundVaultPda,
          buyer: buyer2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer2])
        .rpc();

      try {
        await program.methods
          .refund()
          .accounts({
            event: selfRefundEventPda,
            ticket: selfRefundTicketPda,
            vault: selfRefundVaultPda,
            ticketOwner: buyer2.publicKey,
            eventAuthority: buyer2.publicKey, // Trying to use buyer as authority
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer2]) // Ticket owner trying to refund themselves
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Expected to fail - constraint violation (not event authority)
        expect(error).to.exist;
      }
    });

    // UNHAPPY PATH: Try to refund a used ticket (if we could cancel the event)
    it("Fails to refund a used ticket", async () => {
      // Create another event and ticket for this test
      const usedTicketEventId = 101;
      const [usedEventPda] = getEventPda(
        eventAuthority.publicKey,
        usedTicketEventId
      );

      await program.methods
        .initializeEvent(
          usedTicketEventId,
          ticketPrice,
          5,
          "Used Ticket Event",
          eventDate
        )
        .accounts({
          event: usedEventPda,
          eventAuthority: eventAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([eventAuthority])
        .rpc();

      const [usedTicketPda] = getTicketPda(usedEventPda, 0);
      const [usedVaultPda] = getVaultPda(usedEventPda);

      await program.methods
        .mintTicket()
        .accounts({
          event: usedEventPda,
          ticket: usedTicketPda,
          vault: usedVaultPda,
          buyer: buyer1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer1])
        .rpc();

      // Check in the ticket (mark as used)
      await program.methods
        .checkIn()
        .accounts({
          event: usedEventPda,
          ticket: usedTicketPda,
          eventAuthority: eventAuthority.publicKey,
        })
        .signers([eventAuthority])
        .rpc();

      // Admin tries to refund a used ticket - should fail
      try {
        await program.methods
          .refund()
          .accounts({
            event: usedEventPda,
            ticket: usedTicketPda,
            vault: usedVaultPda,
            ticketOwner: buyer1.publicKey,
            eventAuthority: eventAuthority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([eventAuthority]) // Event authority signing
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Should fail with CannotRefundUsedTicket error
        expect(error.toString()).to.include("CannotRefundUsedTicket");
      }
    });
  });

  // ============================================================================
  // SUMMARY OF TESTS
  // ============================================================================
  // ✅ initialize_event:
  //    - Happy: Create event successfully
  //    - Unhappy: Duplicate event fails
  //    - Unhappy: Name too long fails
  //
  // ✅ mint_ticket:
  //    - Happy: Mint first ticket
  //    - Happy: Mint second ticket
  //    - Happy: Mint last ticket
  //    - Unhappy: Sold out fails
  //
  // ✅ transfer_ticket:
  //    - Happy: Transfer ticket successfully
  //    - Unhappy: Unauthorized transfer fails
  //    - Unhappy: Transfer used ticket fails
  //
  // ✅ check_in:
  //    - Happy: Check in ticket
  //    - Unhappy: Double check-in fails
  //    - Unhappy: Unauthorized check-in fails
  //
  // ✅ refund:
  //    - Unhappy: Refund active event fails
  //    - Note: Full refund testing requires cancel_event instruction
});
