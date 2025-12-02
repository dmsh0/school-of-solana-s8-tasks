use anchor_lang::prelude::*;

#[error_code]
pub enum EventTicketingError {
    #[msg("Event already exists")]
    EventAlreadyExists,
    #[msg("Event is sold out")]
    EventSoldOut,
    #[msg("Event has been canceled")]
    EventCanceled,
    #[msg("Only the ticket owner can transfer")]
    UnauthorizedTransfer,
    #[msg("Cannot transfer a used ticket")]
    TicketAlreadyUsed,
    #[msg("Ticket has already been checked in")]
    AlreadyCheckedIn,
    #[msg("Only event authority can check in tickets")]
    UnauthorizedCheckIn,
    #[msg("Cannot refund a used ticket")]
    CannotRefundUsedTicket,
    #[msg("Ticket has already been refunded")]
    AlreadyRefunded,
    #[msg("Event name is too long")]
    NameTooLong,
    #[msg("Event date is too long")]
    DateTooLong,
}
