use anchor_lang::prelude::*;

#[account]
pub struct Event {
    pub event_authority: Pubkey,
    pub price: u64,
    pub supply: u32,
    pub sold: u32,
    pub canceled: bool,
    pub event_id: u32,
    pub name: String,
    pub date: String,
}

impl Event {
    pub fn space(max_name_len: usize, max_date_len: usize) -> usize {
        8 + 32 + 8 + 4 + 4 + 1 + 4 + 4 + max_name_len + 4 + max_date_len
    }
}

#[account]
pub struct Ticket {
    pub owner: Pubkey,
    pub event: Pubkey,
    pub ticket_id: u32,
    pub is_used: bool,
    pub refunded: bool,
}

impl Ticket {
    pub const SPACE: usize = 8 + 32 + 32 + 4 + 1 + 1;
}

#[account]
pub struct OrganizerRegistry {
    pub organizer: Pubkey,
    pub registered_at: i64,
}

impl OrganizerRegistry {
    pub const SPACE: usize = 8 + 32 + 8;
}
