use crate::constants::*;
use crate::errors::EventTicketingError;
use crate::state::Event;
use anchor_lang::prelude::*;

pub fn initialize_event(
    ctx: Context<InitializeEvent>,
    event_id: u32,
    price: u64,
    supply: u32,
    name: String,
    date: String,
) -> Result<()> {
    require!(name.len() <= MAX_NAME_LEN, EventTicketingError::NameTooLong);
    require!(date.len() <= MAX_DATE_LEN, EventTicketingError::DateTooLong);

    let event = &mut ctx.accounts.event;

    event.event_authority = ctx.accounts.event_authority.key();
    event.price = price;
    event.supply = supply;
    event.sold = 0;
    event.canceled = false;
    event.event_id = event_id;
    event.name = name;
    event.date = date;

    msg!("Event initialized with ID: {}", event_id);

    Ok(())
}

#[derive(Accounts)]
#[instruction(event_id: u32)]
pub struct InitializeEvent<'info> {
    #[account(
        init,
        payer = event_authority,
        space = Event::space(MAX_NAME_LEN, MAX_DATE_LEN),
        seeds = [
            EVENT_SEED,
            event_authority.key().as_ref(),
            &event_id.to_le_bytes()
        ],
        bump
    )]
    pub event: Account<'info, Event>,

    #[account(mut)]
    pub event_authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}
