//-------------------------------------------------------------------------------
use crate::errors::VaultError;
use crate::events::WithdrawEvent;
use crate::state::Vault;
///
/// TASK: Implement the withdraw functionality for the on-chain vault
///
/// Requirements:
/// - Verify that the vault is not locked
/// - Verify that the vault has enough balance to withdraw
/// - Transfer lamports from vault to vault authority
/// - Emit a withdraw event after successful transfer
///
///-------------------------------------------------------------------------------
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub vault_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", vault_authority.key().as_ref()],
        bump,
        has_one = vault_authority
    )]
    pub vault: Account<'info, Vault>,
}

pub fn _withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let vault_authority = &ctx.accounts.vault_authority;

    require!(!vault.locked, VaultError::VaultLocked);

    let vault_balance = vault.to_account_info().lamports();
    require!(vault_balance >= amount, VaultError::InsufficientBalance);

    **vault.to_account_info().try_borrow_mut_lamports()? -= amount;
    **vault_authority
        .to_account_info()
        .try_borrow_mut_lamports()? += amount;

    emit!(WithdrawEvent {
        amount,
        vault_authority: vault_authority.key(),
        vault: vault.key(),
    });

    Ok(())
}
