use crate::errors::EventTicketingError;
use crate::state::{Event, Ticket};
use anchor_lang::prelude::*;
use anchor_lang::system_program;

pub fn refund(ctx: Context<Refund>) -> Result<()> {
    let event = &ctx.accounts.event;
    let ticket = &mut ctx.accounts.ticket;

    require!(!ticket.is_used, EventTicketingError::CannotRefundUsedTicket);
    require!(!ticket.refunded, EventTicketingError::AlreadyRefunded);

    let refund_amount = event.price;

    let event_key = event.key();
    let seeds = &[b"vault".as_ref(), event_key.as_ref(), &[ctx.bumps.vault]];
    let signer_seeds = &[&seeds[..]];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.ticket_owner.to_account_info(),
            },
            signer_seeds,
        ),
        refund_amount,
    )?;

    ticket.refunded = true;

    msg!(
        "Ticket #{} refunded {} lamports to {} by event authority {}",
        ticket.ticket_id,
        refund_amount,
        ctx.accounts.ticket_owner.key(),
        ctx.accounts.event_authority.key()
    );

    Ok(())
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        constraint = event.event_authority == event_authority.key()
    )]
    pub event: Account<'info, Event>,

    #[account(
        mut,
        constraint = ticket.event == event.key()
    )]
    pub ticket: Account<'info, Ticket>,

    /// CHECK: This is the vault PDA that holds event funds. Verified by seeds.
    #[account(
        mut,
        seeds = [
            b"vault",
            event.key().as_ref()
        ],
        bump
    )]
    pub vault: AccountInfo<'info>,

    /// CHECK: This is the ticket owner who will receive the refund. No signature required.
    #[account(mut)]
    pub ticket_owner: AccountInfo<'info>,

    pub event_authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}
