use crate::errors::EventTicketingError;
use crate::state::Ticket;
use anchor_lang::prelude::*;

pub fn transfer_ticket(ctx: Context<TransferTicket>) -> Result<()> {
    let ticket = &mut ctx.accounts.ticket;

    require!(!ticket.is_used, EventTicketingError::TicketAlreadyUsed);
    require!(!ticket.refunded, EventTicketingError::AlreadyRefunded);

    ticket.owner = ctx.accounts.new_owner.key();

    msg!(
        "Ticket #{} transferred to {}",
        ticket.ticket_id,
        ctx.accounts.new_owner.key()
    );

    Ok(())
}

#[derive(Accounts)]
pub struct TransferTicket<'info> {
    #[account(
        mut,
        constraint = ticket.owner == current_owner.key() @ EventTicketingError::UnauthorizedTransfer
    )]
    pub ticket: Account<'info, Ticket>,

    pub current_owner: Signer<'info>,

    /// CHECK: This is the recipient of the ticket. Can be any valid account.
    pub new_owner: AccountInfo<'info>,
}
