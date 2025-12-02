use crate::errors::EventTicketingError;
use crate::state::{Event, Ticket};
use anchor_lang::prelude::*;

pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
    let ticket = &mut ctx.accounts.ticket;

    require!(!ticket.is_used, EventTicketingError::AlreadyCheckedIn);
    require!(!ticket.refunded, EventTicketingError::AlreadyRefunded);

    ticket.is_used = true;

    msg!(
        "Ticket #{} for event {} checked in by {}",
        ticket.ticket_id,
        ctx.accounts.event.event_id,
        ticket.owner
    );

    Ok(())
}

#[derive(Accounts)]
pub struct CheckIn<'info> {
    pub event: Account<'info, Event>,

    #[account(
        mut,
        constraint = ticket.event == event.key() @ EventTicketingError::UnauthorizedCheckIn
    )]
    pub ticket: Account<'info, Ticket>,

    #[account(
        constraint = event_authority.key() == event.event_authority @ EventTicketingError::UnauthorizedCheckIn
    )]
    pub event_authority: Signer<'info>,
}
