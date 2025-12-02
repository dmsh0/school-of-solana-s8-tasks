use anchor_lang::prelude::*;

declare_id!("5wkLPJVMaiemo3Nn5QdAgdifjZig3DWUR9pxAGAeCXZJ");

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

#[program]
pub mod event_ticketing {
    use super::*;

    pub fn register_organizer(ctx: Context<RegisterOrganizer>) -> Result<()> {
        instructions::register_organizer(ctx)
    }

    pub fn initialize_event(
        ctx: Context<InitializeEvent>,
        event_id: u32,
        price: u64,
        supply: u32,
        name: String,
        date: String,
    ) -> Result<()> {
        instructions::initialize_event(ctx, event_id, price, supply, name, date)
    }

    pub fn mint_ticket(ctx: Context<MintTicket>) -> Result<()> {
        instructions::mint_ticket(ctx)
    }

    pub fn transfer_ticket(ctx: Context<TransferTicket>) -> Result<()> {
        instructions::transfer_ticket(ctx)
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        instructions::check_in(ctx)
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        instructions::refund(ctx)
    }

    pub fn cancel_event(ctx: Context<CancelEvent>) -> Result<()> {
        instructions::cancel_event(ctx)
    }
}
