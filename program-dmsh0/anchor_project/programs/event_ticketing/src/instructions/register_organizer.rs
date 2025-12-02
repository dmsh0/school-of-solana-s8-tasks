use crate::constants::ORGANIZER_SEED;
use crate::state::OrganizerRegistry;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RegisterOrganizer<'info> {
    #[account(
        init,
        payer = organizer,
        space = OrganizerRegistry::SPACE,
        seeds = [ORGANIZER_SEED, organizer.key().as_ref()],
        bump
    )]
    pub organizer_registry: Account<'info, OrganizerRegistry>,

    #[account(mut)]
    pub organizer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn register_organizer(ctx: Context<RegisterOrganizer>) -> Result<()> {
    let organizer_registry = &mut ctx.accounts.organizer_registry;
    let clock = Clock::get()?;

    organizer_registry.organizer = ctx.accounts.organizer.key();
    organizer_registry.registered_at = clock.unix_timestamp;

    msg!("Organizer registered: {}", ctx.accounts.organizer.key());

    Ok(())
}
