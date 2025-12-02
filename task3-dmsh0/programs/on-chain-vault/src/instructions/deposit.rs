//-------------------------------------------------------------------------------
use crate::errors::VaultError;
use crate::events::DepositEvent;
use crate::state::Vault;
///
/// TASK: Implement the deposit functionality for the on-chain vault
///
/// Requirements:
/// - Verify that the user has enough balance to deposit
/// - Verify that the vault is not locked
/// - Transfer lamports from user to vault using CPI (Cross-Program Invocation)
/// - Emit a deposit event after successful transfer
///
///-------------------------------------------------------------------------------
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction::transfer;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", vault.vault_authority.as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

pub fn _deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let user = &ctx.accounts.user;

    require!(!vault.locked, VaultError::VaultLocked);

    let user_balance = user.lamports();
    require!(user_balance >= amount, VaultError::InsufficientBalance);

    invoke(
        &transfer(user.key, ctx.accounts.vault.to_account_info().key, amount),
        &[
            user.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    emit!(DepositEvent {
        amount,
        user: user.key(),
        vault: vault.key(),
    });

    Ok(())
}
