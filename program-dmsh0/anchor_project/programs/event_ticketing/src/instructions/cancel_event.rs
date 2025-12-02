use crate::state::Event;
use anchor_lang::prelude::*;

pub fn cancel_event(ctx: Context<CancelEvent>) -> Result<()> {
    let event = &mut ctx.accounts.event;

    event.canceled = true;

    msg!(
        "Event '{}' (ID: {}) has been canceled by {}",
        event.name,
        event.event_id,
        ctx.accounts.event_authority.key()
    );

    Ok(())
}

#[derive(Accounts)]
pub struct CancelEvent<'info> {
    #[account(
        mut,
        constraint = event.event_authority == event_authority.key()
    )]
    pub event: Account<'info, Event>,

    pub event_authority: Signer<'info>,
}
