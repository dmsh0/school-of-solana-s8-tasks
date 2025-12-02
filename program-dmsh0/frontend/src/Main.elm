port module Main exposing (main)

{-| Main entry point for the Event Ticketing Elm application

This app has 3 pages:

1.  Home - View event details and buy tickets
2.  My Tickets - See your tickets, transfer, or refund them
3.  Check-In - Staff page to check in tickets

The app uses ports to communicate with JavaScript for blockchain operations.

-}

import Browser
import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick, onInput)
import Json.Decode as D
import Json.Encode as E



-- ============================================================================
-- CONFIGURATION
-- ============================================================================
-- No hardcoded organizer address needed anymore!
-- Anyone can become an organizer by registering on-chain
-- ============================================================================
-- PORTS
-- ============================================================================
-- Ports allow Elm to communicate with JavaScript
-- Outgoing ports: Elm sends messages to JavaScript
-- Incoming ports: JavaScript sends messages to Elm


{-| Outgoing port: Request wallet connection
-}
port connectWalletPort : () -> Cmd msg


{-| Outgoing port: Load all events
-}
port loadAllEventsPort : () -> Cmd msg


{-| Outgoing port: Create a new event
-}
port createEventPort : E.Value -> Cmd msg


{-| Outgoing port: Cancel an event
-}
port cancelEventPort : E.Value -> Cmd msg


{-| Outgoing port: Buy a ticket
-}
port buyTicketPort : E.Value -> Cmd msg


{-| Outgoing port: Load user's tickets
-}
port loadMyTicketsPort : () -> Cmd msg


{-| Outgoing port: Transfer a ticket
-}
port transferTicketPort : E.Value -> Cmd msg


{-| Outgoing port: Refund a ticket
-}
port refundTicketPort : E.Value -> Cmd msg


{-| Outgoing port: Check in a ticket (staff only)
-}
port checkInTicketPort : E.Value -> Cmd msg


{-| Outgoing port: Check if wallet is registered as organizer
-}
port checkOrganizerStatusPort : () -> Cmd msg


{-| Outgoing port: Register wallet as organizer
-}
port registerOrganizerPort : () -> Cmd msg


{-| Incoming port: Wallet connection result
-}
port walletConnected : (E.Value -> msg) -> Sub msg


{-| Incoming port: All events loaded
-}
port allEventsLoaded : (E.Value -> msg) -> Sub msg


{-| Incoming port: Event created
-}
port eventCreated : (E.Value -> msg) -> Sub msg


{-| Incoming port: Event canceled
-}
port eventCanceled : (E.Value -> msg) -> Sub msg


{-| Incoming port: Ticket purchase result
-}
port ticketBought : (E.Value -> msg) -> Sub msg


{-| Incoming port: User's tickets loaded
-}
port myTicketsLoaded : (E.Value -> msg) -> Sub msg


{-| Incoming port: Ticket transfer result
-}
port ticketTransferred : (E.Value -> msg) -> Sub msg


{-| Incoming port: Ticket refund result
-}
port ticketRefunded : (E.Value -> msg) -> Sub msg


{-| Incoming port: Ticket check-in result
-}
port ticketCheckedIn : (E.Value -> msg) -> Sub msg


{-| Incoming port: Organizer status check result
-}
port organizerStatusChecked : (E.Value -> msg) -> Sub msg


{-| Incoming port: Organizer registration result
-}
port organizerRegistered : (E.Value -> msg) -> Sub msg



-- ============================================================================
-- MODEL
-- ============================================================================


{-| The application state
-}
type alias Model =
    { page : Page
    , wallet : Maybe Wallet
    , isOrganizer : Bool
    , events : List Event
    , myTickets : List Ticket
    , message : String
    , transferRecipients : List ( String, String )
    , checkInTicketAddress : String
    , createEventForm : CreateEventForm
    }


{-| Which page the user is currently viewing
-}
type Page
    = HomePage
    | MyTicketsPage
    | BecomeOrganizerPage
    | CreateEventPage
    | EventManagementPage
    | CheckInPage


{-| User's wallet information
-}
type alias Wallet =
    { publicKey : String
    }


{-| Event account data from the blockchain
-}
type alias Event =
    { address : String
    , eventAuthority : String
    , price : Int
    , supply : Int
    , sold : Int
    , canceled : Bool
    , eventId : Int
    , name : String
    , date : String
    }


{-| Ticket account data from the blockchain
-}
type alias Ticket =
    { address : String
    , owner : String
    , event : String
    , eventName : String
    , ticketId : Int
    , isUsed : Bool
    , refunded : Bool
    }


{-| Form data for creating a new event
-}
type alias CreateEventForm =
    { name : String
    , date : String
    , price : String
    , supply : String
    }


{-| Initial model when the app starts
-}
init : () -> ( Model, Cmd Msg )
init _ =
    ( { page = HomePage
      , wallet = Nothing
      , isOrganizer = False
      , events = []
      , myTickets = []
      , message = ""
      , transferRecipients = []
      , checkInTicketAddress = ""
      , createEventForm = { name = "", date = "", price = "", supply = "" }
      }
    , Cmd.none
    )



-- ============================================================================
-- UPDATE
-- ============================================================================


{-| All possible messages (events) in the application
-}
type Msg
    = NavigateTo Page
    | ConnectWallet
    | WalletConnected E.Value
    | OrganizerStatusChecked E.Value
    | RegisterOrganizer
    | OrganizerRegistered E.Value
    | AllEventsLoaded E.Value
    | UpdateEventFormField String String
    | CreateEvent
    | EventCreated E.Value
    | CancelEvent String
    | EventCanceled E.Value
    | BuyTicket String
    | TicketBought E.Value
    | LoadMyTickets
    | MyTicketsLoaded E.Value
    | UpdateTransferRecipient String String
    | TransferTicket String String
    | TicketTransferred E.Value
    | RefundTicket String String String
    | TicketRefunded E.Value
    | UpdateCheckInAddress String
    | CheckInTicket
    | TicketCheckedIn E.Value


{-| Update function - handles all messages and updates the model
-}
update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        -- Navigation
        NavigateTo page ->
            let
                cmd =
                    case page of
                        MyTicketsPage ->
                            loadMyTicketsPort ()

                        EventManagementPage ->
                            loadMyTicketsPort ()

                        _ ->
                            Cmd.none
            in
            ( { model | page = page, message = "" }, cmd )

        -- Connect Wallet
        ConnectWallet ->
            ( { model | message = "Connecting wallet..." }
            , connectWalletPort ()
            )

        WalletConnected value ->
            case decodeWalletResult value of
                Ok wallet ->
                    ( { model | wallet = Just wallet, message = "Wallet connected: " ++ wallet.publicKey }
                    , Cmd.batch
                        [ loadAllEventsPort ()
                        , checkOrganizerStatusPort ()
                        ]
                    )

                Err error ->
                    ( { model | message = "Error: " ++ error }, Cmd.none )

        -- Organizer Status Check
        OrganizerStatusChecked value ->
            case decodeOrganizerStatusResult value of
                Ok isOrganizer ->
                    ( { model | isOrganizer = isOrganizer }
                    , Cmd.none
                    )

                Err error ->
                    ( { model | message = "Error checking organizer status: " ++ error }, Cmd.none )

        -- Register as Organizer
        RegisterOrganizer ->
            ( { model | message = "Registering as organizer..." }
            , registerOrganizerPort ()
            )

        OrganizerRegistered value ->
            case decodeTransactionResult value of
                Ok signature ->
                    ( { model
                        | message = "Successfully registered as organizer! TX: " ++ signature
                        , isOrganizer = True
                        , page = HomePage
                      }
                    , Cmd.none
                    )

                Err error ->
                    ( { model | message = "Error: " ++ error }, Cmd.none )

        -- Load All Events
        AllEventsLoaded value ->
            case decodeEventsResult value of
                Ok events ->
                    ( { model | events = events, message = "" }
                    , loadMyTicketsPort ()
                    )

                Err error ->
                    ( { model | message = "Error: " ++ error }, Cmd.none )

        -- Create Event Form
        UpdateEventFormField field value ->
            let
                form =
                    model.createEventForm

                updatedForm =
                    case field of
                        "name" ->
                            { form | name = value }

                        "date" ->
                            { form | date = value }

                        "price" ->
                            { form | price = value }

                        "supply" ->
                            { form | supply = value }

                        _ ->
                            form
            in
            ( { model | createEventForm = updatedForm }, Cmd.none )

        CreateEvent ->
            let
                form =
                    model.createEventForm
            in
            ( { model | message = "Creating event..." }
            , createEventPort
                (E.object
                    [ ( "name", E.string form.name )
                    , ( "date", E.string form.date )
                    , ( "price", E.string form.price )
                    , ( "supply", E.string form.supply )
                    ]
                )
            )

        EventCreated value ->
            case decodeTransactionResult value of
                Ok signature ->
                    ( { model
                        | message = "Event created! TX: " ++ signature
                        , createEventForm = { name = "", date = "", price = "", supply = "" }
                        , page = HomePage
                      }
                    , loadAllEventsPort ()
                    )

                Err error ->
                    ( { model | message = "Error: " ++ error }, Cmd.none )

        -- Cancel Event
        CancelEvent eventAddress ->
            ( { model | message = "Canceling event..." }
            , cancelEventPort
                (E.object
                    [ ( "eventAddress", E.string eventAddress )
                    ]
                )
            )

        EventCanceled value ->
            case decodeTransactionResult value of
                Ok signature ->
                    ( { model | message = "Event canceled! TX: " ++ signature }
                    , loadAllEventsPort ()
                    )

                Err error ->
                    ( { model | message = "Error: " ++ error }, Cmd.none )

        -- Buy Ticket
        BuyTicket eventAddress ->
            ( { model | message = "Buying ticket..." }
            , buyTicketPort
                (E.object
                    [ ( "eventAddress", E.string eventAddress )
                    ]
                )
            )

        TicketBought value ->
            case decodeTransactionResult value of
                Ok signature ->
                    ( { model | message = "Ticket purchased! TX: " ++ signature }
                    , Cmd.none
                    )

                Err error ->
                    ( { model | message = "Error: " ++ error }, Cmd.none )

        -- Load My Tickets
        LoadMyTickets ->
            ( { model | message = "Loading your tickets..." }
            , loadMyTicketsPort ()
            )

        MyTicketsLoaded value ->
            case decodeTicketsResult value of
                Ok tickets ->
                    ( { model | myTickets = tickets, message = "" }
                    , Cmd.none
                    )

                Err error ->
                    ( { model | message = "Error: " ++ error }, Cmd.none )

        -- Transfer Ticket
        UpdateTransferRecipient ticketAddress recipient ->
            let
                updatedRecipients =
                    model.transferRecipients
                        |> List.filter (\( addr, _ ) -> addr /= ticketAddress)
                        |> (::) ( ticketAddress, recipient )
            in
            ( { model | transferRecipients = updatedRecipients }, Cmd.none )

        TransferTicket ticketAddress recipient ->
            ( { model | message = "Transferring ticket..." }
            , transferTicketPort
                (E.object
                    [ ( "ticketAddress", E.string ticketAddress )
                    , ( "newOwner", E.string recipient )
                    ]
                )
            )

        TicketTransferred value ->
            case decodeTransactionResult value of
                Ok signature ->
                    ( { model | message = "Ticket transferred! TX: " ++ signature }
                    , loadMyTicketsPort ()
                    )

                Err error ->
                    ( { model | message = "Error: " ++ error }, Cmd.none )

        -- Refund Ticket
        RefundTicket ticketAddress eventAddress ticketOwner ->
            ( { model | message = "Refunding ticket..." }
            , refundTicketPort
                (E.object
                    [ ( "ticketAddress", E.string ticketAddress )
                    , ( "eventAddress", E.string eventAddress )
                    , ( "ticketOwner", E.string ticketOwner )
                    ]
                )
            )

        TicketRefunded value ->
            case decodeTransactionResult value of
                Ok signature ->
                    ( { model | message = "Ticket refunded! TX: " ++ signature }
                    , loadMyTicketsPort ()
                    )

                Err error ->
                    ( { model | message = "Error: " ++ error }, Cmd.none )

        -- Check In Ticket
        UpdateCheckInAddress address ->
            ( { model | checkInTicketAddress = address }, Cmd.none )

        CheckInTicket ->
            ( { model | message = "Checking in ticket..." }
            , checkInTicketPort
                (E.object
                    [ ( "ticketAddress", E.string model.checkInTicketAddress )
                    ]
                )
            )

        TicketCheckedIn value ->
            case decodeTransactionResult value of
                Ok signature ->
                    ( { model | message = "Ticket checked in! TX: " ++ signature, checkInTicketAddress = "" }
                    , Cmd.none
                    )

                Err error ->
                    ( { model | message = "Error: " ++ error }, Cmd.none )



-- ============================================================================
-- JSON DECODERS
-- ============================================================================


{-| Decode wallet connection result from JavaScript
-}
decodeWalletResult : E.Value -> Result String Wallet
decodeWalletResult value =
    D.decodeValue walletDecoder value
        |> Result.mapError D.errorToString


walletDecoder : D.Decoder Wallet
walletDecoder =
    D.map Wallet
        (D.field "publicKey" D.string)


{-| Decode multiple events from JavaScript
-}
decodeEventsResult : E.Value -> Result String (List Event)
decodeEventsResult value =
    D.decodeValue (D.field "events" (D.list eventDecoder)) value
        |> Result.mapError D.errorToString


eventDecoder : D.Decoder Event
eventDecoder =
    D.succeed Event
        |> andMap (D.field "address" D.string)
        |> andMap (D.field "eventAuthority" D.string)
        |> andMap (D.field "price" D.int)
        |> andMap (D.field "supply" D.int)
        |> andMap (D.field "sold" D.int)
        |> andMap (D.field "canceled" D.bool)
        |> andMap (D.field "eventId" D.int)
        |> andMap (D.field "name" D.string)
        |> andMap (D.field "date" D.string)


andMap : D.Decoder a -> D.Decoder (a -> b) -> D.Decoder b
andMap =
    D.map2 (|>)


{-| Decode tickets list from JavaScript
-}
decodeTicketsResult : E.Value -> Result String (List Ticket)
decodeTicketsResult value =
    D.decodeValue (D.field "tickets" (D.list ticketDecoder)) value
        |> Result.mapError D.errorToString


ticketDecoder : D.Decoder Ticket
ticketDecoder =
    D.succeed Ticket
        |> andMap (D.field "address" D.string)
        |> andMap (D.field "owner" D.string)
        |> andMap (D.field "event" D.string)
        |> andMap (D.field "eventName" D.string)
        |> andMap (D.field "ticketId" D.int)
        |> andMap (D.field "isUsed" D.bool)
        |> andMap (D.field "refunded" D.bool)


{-| Decode transaction result from JavaScript
-}
decodeTransactionResult : E.Value -> Result String String
decodeTransactionResult value =
    D.decodeValue (D.field "signature" D.string) value
        |> Result.mapError D.errorToString


{-| Decode organizer status check result from JavaScript
-}
decodeOrganizerStatusResult : E.Value -> Result String Bool
decodeOrganizerStatusResult value =
    D.decodeValue (D.field "isOrganizer" D.bool) value
        |> Result.mapError D.errorToString



-- ============================================================================
-- VIEW
-- ============================================================================


{-| Main view function - renders the current page
-}
view : Model -> Html Msg
view model =
    div [ class "container" ]
        [ header []
            [ h1 [] [ text "Event Ticketing" ]
            , nav []
                ([ button [ onClick (NavigateTo HomePage) ] [ text "Home" ]
                 , button [ onClick (NavigateTo MyTicketsPage) ] [ text "My Tickets" ]
                 ]
                    ++ (if model.isOrganizer then
                            [ button [ onClick (NavigateTo CreateEventPage) ] [ text "Create Event" ]
                            , button [ onClick (NavigateTo EventManagementPage) ] [ text "Manage Events" ]
                            , button [ onClick (NavigateTo CheckInPage) ] [ text "Check-In" ]
                            ]

                        else if model.wallet /= Nothing then
                            [ button [ onClick (NavigateTo BecomeOrganizerPage) ] [ text "Become Organizer" ]
                            ]

                        else
                            []
                       )
                    ++ [ viewWalletButton model.wallet ]
                )
            ]
        , main_ []
            [ viewMessage model.message
            , case model.page of
                HomePage ->
                    viewHomePage model

                MyTicketsPage ->
                    viewMyTicketsPage model

                BecomeOrganizerPage ->
                    viewBecomeOrganizerPage model

                CreateEventPage ->
                    viewCreateEventPage model

                EventManagementPage ->
                    viewEventManagementPage model

                CheckInPage ->
                    viewCheckInPage model
            ]
        ]


{-| View wallet connection button
-}
viewWalletButton : Maybe Wallet -> Html Msg
viewWalletButton maybeWallet =
    case maybeWallet of
        Nothing ->
            button [ onClick ConnectWallet ] [ text "Connect Wallet" ]

        Just wallet ->
            div [ class "wallet-info" ]
                [ text ("Wallet: " ++ String.left 8 wallet.publicKey ++ "...") ]


{-| View status message
-}
viewMessage : String -> Html Msg
viewMessage message =
    if String.isEmpty message then
        text ""

    else
        div [ class "message" ] [ text message ]


{-| View Home Page - shows event details and buy ticket button
-}
viewHomePage : Model -> Html Msg
viewHomePage model =
    div [ class "page home-page" ]
        [ h2 [] [ text "All Events" ]
        , case model.wallet of
            Nothing ->
                div [ class "help-text" ]
                    [ p [] [ text "👋 Welcome! Please connect your Phantom wallet first." ]
                    ]

            Just wallet ->
                if List.isEmpty model.events then
                    p [ class "help-text" ]
                        [ text
                            ("No events found. "
                                ++ (if model.isOrganizer then
                                        "Create one!"

                                    else
                                        ""
                                   )
                            )
                        ]

                else
                    div [ class "events-list" ]
                        (model.events
                            |> List.sortBy
                                (\e ->
                                    if e.canceled then
                                        1

                                    else
                                        0
                                )
                            |> List.map (viewEvent model.myTickets wallet.publicKey model.isOrganizer)
                        )
        ]


{-| View a single event card
-}
viewEvent : List Ticket -> String -> Bool -> Event -> Html Msg
viewEvent myTickets walletPublicKey isOrganizer event =
    let
        myTicketsForEvent =
            List.filter (\t -> t.event == event.address && t.owner == walletPublicKey) myTickets

        hasTicket =
            not (List.isEmpty myTicketsForEvent)

        ticketCount =
            List.length myTicketsForEvent
    in
    div [ class "event-card" ]
        [ h3 [] [ text event.name ]
        , p [] [ text ("Date: " ++ event.date) ]
        , p [] [ text ("Price: " ++ String.fromInt event.price ++ " lamports") ]
        , p [] [ text ("Tickets: " ++ String.fromInt event.sold ++ " / " ++ String.fromInt event.supply) ]
        , div [ class "address-field" ]
            [ span [ class "address-label" ] [ text "Event Address: " ]
            , span [ class "address-value" ] [ text event.address ]
            ]
        , div [ class "address-field" ]
            [ span [ class "address-label" ] [ text "Event Organizer: " ]
            , span [ class "address-value" ] [ text event.eventAuthority ]
            ]
        , p
            [ class
                (if event.canceled then
                    "status-canceled"

                 else if event.sold >= event.supply then
                    "status-sold-out"

                 else
                    "status-available"
                )
            ]
            [ text
                (if event.canceled then
                    "Status: CANCELED"

                 else if event.sold >= event.supply then
                    "Status: SOLD OUT"

                 else
                    "Status: Available"
                )
            ]
        , if hasTicket then
            p [ class "my-tickets-indicator" ] [ text ("✓ You have " ++ String.fromInt ticketCount ++ " ticket(s)") ]

          else
            text ""
        , div [ class "event-actions" ]
            [ if not event.canceled && event.sold < event.supply then
                button [ onClick (BuyTicket event.address) ] [ text "Buy Ticket" ]

              else
                text ""
            , if isOrganizer && walletPublicKey == event.eventAuthority && not event.canceled then
                button [ onClick (CancelEvent event.address), class "cancel-button" ] [ text "Cancel Event" ]

              else
                text ""
            ]
        ]


{-| View Become Organizer Page - allows any user to register as an organizer
-}
viewBecomeOrganizerPage : Model -> Html Msg
viewBecomeOrganizerPage model =
    div [ class "page become-organizer-page" ]
        [ h2 [] [ text "Become an Event Organizer" ]
        , case model.wallet of
            Nothing ->
                p [ class "help-text" ] [ text "Please connect your wallet first." ]

            Just _ ->
                if model.isOrganizer then
                    div [ class "already-registered" ]
                        [ h3 [] [ text "✅ You're Already Registered!" ]
                        , p [] [ text "You can now create events, manage your events, and check in attendees." ]
                        , button [ onClick (NavigateTo CreateEventPage), class "accent" ] [ text "Create Your First Event" ]
                        ]

                else
                    div []
                        [ p [ class "help-text" ] [ text "Register as an event organizer to unlock powerful event management features:" ]
                        , div [ class "organizer-benefits" ]
                            [ div [ class "benefit-card" ]
                                [ span [ class "benefit-icon" ] [ text "🎫" ]
                                , h4 [] [ text "Create Events" ]
                                , p [] [ text "Launch events with custom pricing, ticket supply, dates, and descriptions." ]
                                ]
                            , div [ class "benefit-card" ]
                                [ span [ class "benefit-icon" ] [ text "⚙️" ]
                                , h4 [] [ text "Manage Events" ]
                                , p [] [ text "Cancel events when needed and issue refunds to ticket holders automatically." ]
                                ]
                            , div [ class "benefit-card" ]
                                [ span [ class "benefit-icon" ] [ text "✅" ]
                                , h4 [] [ text "Check-In System" ]
                                , p [] [ text "Verify and check in attendees at your event entrance with on-chain validation." ]
                                ]
                            , div [ class "benefit-card" ]
                                [ span [ class "benefit-icon" ] [ text "📊" ]
                                , h4 [] [ text "Track Revenue" ]
                                , p [] [ text "Monitor ticket sales, revenue, and attendance data in real-time." ]
                                ]
                            ]
                        , div [ class "registration-info" ]
                            [ strong [] [ text "💡 Registration Details:" ]
                            , p [] [ text "Registration requires a small one-time fee (~0.001 SOL) to create your organizer account on-chain. This covers the blockchain storage cost." ]
                            ]
                        , button [ onClick RegisterOrganizer, class "accent" ] [ text "Register as Organizer" ]
                        ]
        ]


{-| View Create Event Page - form to create a new event (organizer only)
-}
viewCreateEventPage : Model -> Html Msg
viewCreateEventPage model =
    div [ class "page create-event-page" ]
        [ h2 [] [ text "Create New Event" ]
        , case model.wallet of
            Nothing ->
                p [ class "help-text" ] [ text "Please connect your wallet first." ]

            Just _ ->
                if not model.isOrganizer then
                    p [ class "help-text" ] [ text "⚠️ You need to be a registered organizer to create events." ]

                else
                    div [ class "create-event-form" ]
                        [ div [ class "form-field" ]
                            [ label [] [ text "Event Name:" ]
                            , input
                                [ type_ "text"
                                , placeholder "e.g., Blockchain Conference 2025"
                                , value model.createEventForm.name
                                , onInput (UpdateEventFormField "name")
                                ]
                                []
                            ]
                        , div [ class "form-field" ]
                            [ label [] [ text "Date:" ]
                            , input
                                [ type_ "text"
                                , placeholder "e.g., 2025-12-25"
                                , value model.createEventForm.date
                                , onInput (UpdateEventFormField "date")
                                ]
                                []
                            ]
                        , div [ class "form-field" ]
                            [ label [] [ text "Ticket Price (in SOL):" ]
                            , input
                                [ type_ "text"
                                , placeholder "e.g., 0.1 or 1"
                                , value model.createEventForm.price
                                , onInput (UpdateEventFormField "price")
                                ]
                                []
                            ]
                        , div [ class "form-field" ]
                            [ label [] [ text "Total Ticket Supply:" ]
                            , input
                                [ type_ "text"
                                , placeholder "e.g., 100"
                                , value model.createEventForm.supply
                                , onInput (UpdateEventFormField "supply")
                                ]
                                []
                            ]
                        , button [ onClick CreateEvent ] [ text "Create Event" ]
                        , p [ class "help-text" ] [ text "Note: Event ID will be generated automatically based on timestamp." ]
                        ]
        ]


{-| View My Tickets Page - shows user's tickets with transfer/refund options
-}
viewMyTicketsPage : Model -> Html Msg
viewMyTicketsPage model =
    div [ class "page my-tickets-page" ]
        [ h2 [] [ text "My Tickets" ]
        , case model.wallet of
            Nothing ->
                p [ class "help-text" ] [ text "Please connect your wallet to view your tickets." ]

            Just wallet ->
                let
                    myOwnedTickets =
                        List.filter (\t -> t.owner == wallet.publicKey) model.myTickets
                in
                if List.isEmpty myOwnedTickets then
                    p [ class "help-text" ] [ text "You don't have any tickets yet. Buy tickets from the Home page!" ]

                else
                    div [ class "tickets-list" ]
                        (List.map (viewTicket model.transferRecipients) myOwnedTickets)
        ]


{-| View a single ticket
-}
viewTicket : List ( String, String ) -> Ticket -> Html Msg
viewTicket transferRecipients ticket =
    let
        currentRecipient =
            transferRecipients
                |> List.filter (\( addr, _ ) -> addr == ticket.address)
                |> List.head
                |> Maybe.map (\( _, recipient ) -> recipient)
                |> Maybe.withDefault ""
    in
    div [ class "ticket-card" ]
        [ h3 [] [ text (ticket.eventName ++ " - Ticket #" ++ String.fromInt ticket.ticketId) ]
        , div [ class "address-field" ]
            [ span [ class "address-label" ] [ text "Ticket Address: " ]
            , span [ class "address-value" ] [ text ticket.address ]
            ]
        , div [ class "address-field" ]
            [ span [ class "address-label" ] [ text "Event Name: " ]
            , span [ class "address-value" ] [ text ticket.eventName ]
            ]
        , div [ class "address-field" ]
            [ span [ class "address-label" ] [ text "Event Address: " ]
            , span [ class "address-value" ] [ text ticket.event ]
            ]
        , div [ class "address-field" ]
            [ span [ class "address-label" ] [ text "Owner: " ]
            , span [ class "address-value" ] [ text ticket.owner ]
            ]
        , p []
            [ text
                (if ticket.refunded then
                    "Status: REFUNDED"

                 else if ticket.isUsed then
                    "Status: USED"

                 else
                    "Status: ACTIVE"
                )
            ]
        , if not ticket.isUsed && not ticket.refunded then
            div [ class "ticket-actions" ]
                [ input
                    [ type_ "text"
                    , placeholder "Recipient address"
                    , value currentRecipient
                    , onInput (UpdateTransferRecipient ticket.address)
                    ]
                    []
                , button [ onClick (TransferTicket ticket.address currentRecipient) ] [ text "Transfer" ]
                ]

          else
            text ""
        , p [ class "help-text" ]
            [ text "💡 Note: Only event organizers can issue refunds. Contact the event organizer if you need a refund." ]
        ]


{-| View Check-In Page - staff page to check in tickets
-}
viewCheckInPage : Model -> Html Msg
viewCheckInPage model =
    div [ class "page checkin-page" ]
        [ h2 [] [ text "Staff Check-In" ]
        , div [ class "staff-warning" ]
            [ text "⚠️ EVENT STAFF ONLY - Only the event organizer can check in tickets" ]
        , div [ class "check-in-steps" ]
            [ div [ class "step-card" ]
                [ div [ class "step-number" ] [ text "1" ]
                , h4 [] [ text "Request Wallet Address" ]
                , p [] [ text "Ask the attendee for their Solana wallet address." ]
                ]
            , div [ class "step-card" ]
                [ div [ class "step-number" ] [ text "2" ]
                , h4 [] [ text "Verify Wallet Ownership" ]
                , p [] [ text "Confirm they control the wallet by asking them to:" ]
                , ul []
                    [ li [] [ text "Show their wallet app with the address visible, OR" ]
                    , li [] [ text "Send a small test amount (e.g., 0.001 SOL) to prove ownership" ]
                    ]
                ]
            , div [ class "step-card" ]
                [ div [ class "step-number" ] [ text "3" ]
                , h4 [] [ text "Look Up Ticket On-Chain" ]
                , p [] [ text "Search for tickets owned by their wallet address on the blockchain and verify the ticket is:" ]
                , ul []
                    [ li [] [ text "Valid for this event" ]
                    , li [] [ text "Not already used" ]
                    , li [] [ text "Not refunded" ]
                    ]
                ]
            , div [ class "step-card" ]
                [ div [ class "step-number" ] [ text "4" ]
                , h4 [] [ text "Complete Check-In" ]
                , p [] [ text "Once verified, enter the ticket address below and click 'Check In Ticket'." ]
                ]
            ]
        , div [ class "security-note" ]
            [ strong [] [ text "🔐 Security Note:" ]
            , p [] [ text "Ticket addresses are public on the blockchain, but only the wallet owner can prove they control the wallet that owns the ticket. Always verify wallet ownership before check-in!" ]
            ]
        , case model.wallet of
            Nothing ->
                p [ class "help-text" ] [ text "Please connect your wallet first." ]

            Just _ ->
                div [ class "checkin-form" ]
                    [ input
                        [ type_ "text"
                        , placeholder "Ticket address (after verifying wallet ownership)"
                        , value model.checkInTicketAddress
                        , onInput UpdateCheckInAddress
                        ]
                        []
                    , button [ onClick CheckInTicket ] [ text "Check In Ticket" ]
                    ]
        ]


{-| View Event Management Page - admin page to manage events and issue refunds
-}
viewEventManagementPage : Model -> Html Msg
viewEventManagementPage model =
    div [ class "page event-management-page" ]
        [ h2 [] [ text "Event Management" ]
        , case model.wallet of
            Nothing ->
                p [ class "help-text" ] [ text "Please connect your wallet first." ]

            Just wallet ->
                if not model.isOrganizer then
                    p [ class "help-text" ] [ text "⚠️ You need to be a registered organizer to access this page." ]

                else
                    div []
                        [ p [ class "help-text" ] [ text "Manage tickets and issue refunds for your events." ]
                        , if List.isEmpty model.events then
                            p [] [ text "No events found." ]

                          else
                            div [ class "events-management-list" ]
                                (List.filter (\e -> e.eventAuthority == wallet.publicKey) model.events
                                    |> List.sortBy
                                        (\e ->
                                            if e.canceled then
                                                1

                                            else
                                                0
                                        )
                                    |> List.map (viewEventManagement model.myTickets)
                                )
                        ]
        ]


{-| View a single event with its tickets for management
-}
viewEventManagement : List Ticket -> Event -> Html Msg
viewEventManagement allTickets event =
    let
        eventTickets =
            List.filter (\t -> t.event == event.address) allTickets

        activeTickets =
            List.filter (\t -> not t.refunded && not t.isUsed) eventTickets

        usedTickets =
            List.filter (\t -> t.isUsed) eventTickets

        refundedTickets =
            List.filter (\t -> t.refunded) eventTickets
    in
    div [ class "event-management-card" ]
        [ h3 [] [ text event.name ]
        , p [] [ text ("Date: " ++ event.date) ]
        , p [] [ text ("Price: " ++ String.fromInt event.price ++ " lamports") ]
        , p [] [ text ("Sold: " ++ String.fromInt event.sold ++ " / " ++ String.fromInt event.supply) ]
        , p
            [ class
                (if event.canceled then
                    "status-canceled"

                 else
                    "status-available"
                )
            ]
            [ text
                (if event.canceled then
                    "Status: CANCELED"

                 else
                    "Status: ACTIVE"
                )
            ]
        , div [ class "event-stats" ]
            [ p [] [ text ("Active Tickets: " ++ String.fromInt (List.length activeTickets)) ]
            , p [] [ text ("Used Tickets: " ++ String.fromInt (List.length usedTickets)) ]
            , p [] [ text ("Refunded Tickets: " ++ String.fromInt (List.length refundedTickets)) ]
            ]
        , if not (List.isEmpty activeTickets) then
            div [ class "tickets-to-refund" ]
                [ h4 [] [ text "Active Tickets - Issue Refunds:" ]
                , div [ class "tickets-grid" ]
                    (List.map viewTicketForRefund activeTickets)
                ]

          else
            text ""
        ]


{-| View a ticket with refund button for admin
-}
viewTicketForRefund : Ticket -> Html Msg
viewTicketForRefund ticket =
    div [ class "ticket-refund-card" ]
        [ p [] [ text ("Ticket #" ++ String.fromInt ticket.ticketId) ]
        , div [ class "address-field-small" ]
            [ span [ class "address-label" ] [ text "Owner: " ]
            , span [ class "address-value" ] [ text (String.left 8 ticket.owner ++ "...") ]
            ]
        , button
            [ onClick (RefundTicket ticket.address ticket.event ticket.owner)
            , class "refund-button"
            ]
            [ text "Issue Refund" ]
        ]



-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================


{-| Subscribe to incoming port messages from JavaScript
-}
subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.batch
        [ walletConnected WalletConnected
        , organizerStatusChecked OrganizerStatusChecked
        , organizerRegistered OrganizerRegistered
        , allEventsLoaded AllEventsLoaded
        , eventCreated EventCreated
        , eventCanceled EventCanceled
        , ticketBought TicketBought
        , myTicketsLoaded MyTicketsLoaded
        , ticketTransferred TicketTransferred
        , ticketRefunded TicketRefunded
        , ticketCheckedIn TicketCheckedIn
        ]



-- ============================================================================
-- MAIN
-- ============================================================================


{-| Main entry point - wires everything together
-}
main : Program () Model Msg
main =
    Browser.element
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }
