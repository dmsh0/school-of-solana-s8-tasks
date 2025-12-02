use crate::constants::*;
use crate::errors::EventTicketingError;
use crate::state::{Event, Ticket};
use anchor_lang::prelude::*;
use anchor_lang::system_program;

pub fn mint_ticket(ctx: Context<MintTicket>) -> Result<()> {
    let event = &mut ctx.accounts.event;
    let ticket = &mut ctx.accounts.ticket;

    require!(!event.canceled, EventTicketingError::EventCanceled);
    require!(event.sold < event.supply, EventTicketingError::EventSoldOut);

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        },
    );

    system_program::transfer(cpi_context, event.price)?;

    let ticket_id = event.sold;

    ticket.owner = ctx.accounts.buyer.key();
    ticket.event = event.key();
    ticket.ticket_id = ticket_id;
    ticket.is_used = false;
    ticket.refunded = false;

    event.sold += 1;

    msg!("Ticket #{} minted for event {}", ticket_id, event.event_id);

    Ok(())
}

#[derive(Accounts)]
pub struct MintTicket<'info> {
    #[account(mut)]
    pub event: Account<'info, Event>,

    #[account(
        init,
        payer = buyer,
        space = Ticket::SPACE,
        seeds = [
            TICKET_SEED,
            event.key().as_ref(),
            &event.sold.to_le_bytes()
        ],
        bump
    )]
    pub ticket: Account<'info, Ticket>,

    /// CHECK: This is the vault PDA that holds event funds. It's derived with correct seeds.
    #[account(
        mut,
        seeds = [
            VAULT_SEED,
            event.key().as_ref()
        ],
        bump
    )]
    pub vault: AccountInfo<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}
