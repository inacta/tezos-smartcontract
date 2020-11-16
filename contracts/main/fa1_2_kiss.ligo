type account is record
    balance : nat;
    allowances: map(address, nat);

     // debit is made to account for negative balances, to make this compliant with FA1.2 standard which
     // does not allow negative numbers for balances
    debit: nat;
end

type activity is nat;

(* KISS-specific data structures *)

// Helper record for the registration of tandem claims
type signed_claim is record
    signature: signature;
    pk: key;
    sender: address; // can be derived from pk
    minutes: nat;
    activities: set(nat);
    recipients: set(address);
end

type tandem_claim_helpee is record
    address: address;
    pk: key;
    signature: signature;
end

// helpees needs to be a list (as opposed to sets) since signature values are not
// comparable and set can only handle comparable types. tandem_claim_helpee
// contains a field of type signature.
type helpees is
| Signed_helpee of list(tandem_claim_helpee)
| Admin_helpee of list(address)

type tandem_claim is record
    helpees: helpees;
    helpers: set(address); // those who receive minutes
    activities: set(activity);
    minutes: nat;
end

type tandem_claim_michelson is michelson_pair_right_comb(tandem_claim);

type tandem_param is list(tandem_claim_michelson);

// Change_admin_this is called so to prevent name clash with endpoint in activity log contract
type action is
| Transfer of (address * address * nat)
| Approve of (address * nat)
| Get_allowance of (address * address * contract(nat))
| Get_balance of (address * contract(nat))
| Get_total_supply of (unit * contract(nat))
| Register_tandem_claims of tandem_param
| Change_activity_log of address
| Change_admin_this of address
| Call_add_allowed_activity of nat
| Call_suspend_allowed_activity of nat
| Call_change_admin of address

(* Endpoints for the external activity log contract *)
type add_allowed_activity is Add_allowed_activity of nat;
type suspend_allowed_activity is Suspend_allowed_activity of nat;
type update_activity_balance is Update_activity_balance of list(list((nat * nat)));
type change_admin is Change_admin of address;

(* Type definition for storage *)
type storage is record
  external_contract_address: address;
  ledger: big_map(address, account);

  // nonces are used to prevent replay attacks where signatures can be reused
  nonces: big_map(address, nat);
  total_supply: nat;

  allowed_activities: map(nat, bool);
  admin: address; // admin can e.g. change approved activities
end

(* KISS-specific endpoints *)
function call_add_allowed_activity(const new_activity: nat; var storage: storage) : (list(operation) * storage) is
begin
    if Tezos.sender =/= storage.admin then
        failwith("CALLER_NOT_ADMIN");
    else
        skip;

    // If activity already exists, ignore and do not report error
    storage.allowed_activities[new_activity] := True;

    // Prepare call to external contract
    const other_contract: contract(add_allowed_activity) =
    case (Tezos.get_entrypoint_opt("%add_allowed_activity", storage.external_contract_address): option(contract(add_allowed_activity))) of
      | Some (c) -> c
      | None -> (failwith("not a correct contract") : contract(add_allowed_activity))
    end;
end with ((list [Tezos.transaction(Add_allowed_activity(new_activity), 0mutez, other_contract)] : list(operation)), storage);

function call_suspend_allowed_activity(const activity: nat; var storage: storage) : (list(operation) * storage) is
begin
    if Tezos.sender =/= storage.admin then
        failwith("CALLER_NOT_ADMIN");
    else
        skip;

    // only allow suspension of already registered activities
    case storage.allowed_activities[activity] of
        | Some(allowed) -> storage.allowed_activities[activity] := False
        | None -> failwith("ACTIVITY_DOES_NOT_EXIST")
    end;

    // Prepare call to external contract
    const other_contract: contract(suspend_allowed_activity) =
    case (Tezos.get_entrypoint_opt("%suspend_allowed_activity", storage.external_contract_address): option(contract(suspend_allowed_activity))) of
      | Some (c) -> c
      | None -> (failwith("not a correct contract") : contract(suspend_allowed_activity))
    end;
end with ((list [Tezos.transaction(Suspend_allowed_activity(activity), 0mutez, other_contract)] : list(operation)), storage);

(* Regular FA1.2 endpoints *)
// This verifies the whitelisting status, as this contract does not yet support whitelisting, it returns unit
function transfer_allowed(const from_ : address ; const to_ : address ; const storage : storage) : unit is Unit;

function is_approved ( const spender : address ; const value : nat ; var s : storage) : bool is
  begin
    var allowed: bool := False;
    if Tezos.sender =/= spender then block {
      const src: account = case s.ledger[spender] of
        Some (acc) -> acc
        | None -> (failwith("NotEnoughAllowance"): account)
      end;
      const allowanceAmount: nat = case src.allowances[Tezos.sender] of
        Some (allowance) -> allowance
        | None -> (failwith("NotEnoughAllowance"): nat)
      end;
      allowed := allowanceAmount >= value;
    };
    else allowed := True;
  end with allowed

// Transfer a specific amount of tokens from the accountFrom address to a destination address
// Pre conditions:
//  The sender address is the account owner or is allowed to spend x in the name of accountFrom
//  The accountFrom account has a balance higher than amount
// Post conditions:
//  The balance of accountFrom is decreased by amount
//  The balance of destination is increased by amount
function transfer (const accountFrom : address ; const destination : address ; const value : nat ; var s : storage) : storage is
 begin
  if accountFrom = destination then skip;
  else block {
    // Verify that caller address (Sender) is allowed to spend from this address
    const allowed = is_approved(accountFrom, value, s);
    if allowed then
        skip;
    else
        failwith ("NotEnoughAllowance");

    const unit_value: unit = transfer_allowed(accountFrom, destination, s);

    // Fetch src account, a source account will not exist in storage
    // if accountFrom has never received an amount, nor approved any
    // address to spend from it
    var src: account := record
        balance = 0n;
        allowances = (map end : map(address, nat));
        debit = 0n;
    end;
    case s.ledger[accountFrom] of
      | Some (acc) -> src := acc
      | None -> skip
    end;

    // Check that the source can spend that much
    if value > src.balance then
        failwith ("NotEnoughBalance");
    else
        skip;

    // Update the source balance
    // Using the abs function to convert int to nat
    src.balance := abs(src.balance - value);

    // Decrease the allowance amount if necessary
    if accountFrom =/= sender then block {
        const allowanceAmount: nat = case src.allowances[Tezos.sender] of
          Some (allowance) -> allowance
          | None -> (failwith("NoAllowance"): nat)
        end;
        if allowanceAmount - value < 0 then
            failwith ("Allowance amount cannot be negative");
        else
            src.allowances[Tezos.sender] := abs(allowanceAmount - value);
    } else skip;

    s.ledger[accountFrom] := src;

    // Fetch dst account or add empty dst account to ledger
    var dst: account := record
        balance = 0n;
        allowances = (map end : map(address, nat));
        debit = 0n;
    end;
    case s.ledger[destination] of
      | None -> skip
      | Some(n) -> dst := n
    end;

    dst.balance := dst.balance + value;

    s.ledger[destination] := dst;
  }
 end with s

// Approve an amount to be spent by another address in the name of the sender
// Pre conditions:
//  The spender account is not the sender account
// Post conditions:
//  The allowance of spender in the name of sender is value
function approve (const spender : address ; const value : nat ; var s : storage) : storage is
 begin
  // If sender is the spender approving is not necessary
  if Tezos.sender = spender then skip;
  else block {
      var account := record
        balance = 0n;
        allowances = (map end : map(address, nat));
        debit = 0n;
      end;
      case s.ledger[Tezos.sender] of
          Some (acc) -> account := acc
          | None -> skip
      end;

      // Verify that this change is not unsafe, as specified in the interface definition
      case account.allowances[spender] of
        Some (current_value) -> block {
            if current_value > 0n and value > 0n then failwith("UnsafeAllowanceChange") else skip;
        }
        | None -> skip
      end;

      // Update state
      account.allowances[spender] := value;
      s.ledger[Tezos.sender] := account; // Not sure if this last step is necessary
  }
 end with s

// Note that the following three view functions are intended for contract-2-contract interaction,
// they are not like Ethereum's view functions which can run without writing to the blockchain.
// If you want to read a balance or another value from a deployed contract, you should read
// directly from storage.

// View function that forwards the allowance amount of spender in the name of tokenOwner to a contract
// Pre conditions:
//  None
// Post conditions:
//  The state is unchanged
function get_allowance (const owner : address ; const spender : address ; const contr : contract(nat) ; var s : storage) : list(operation) is
begin
    const destAllowance: nat =
    case s.ledger[owner] of
        | None -> 0n
        | Some (acc) ->
        case acc.allowances[spender] of
            | None -> 0n
            | Some (allowance) -> allowance
        end
    end;
end with list [transaction(destAllowance, 0tz, contr)]

// View function that forwards the balance of source to a contract
// Pre conditions:
//  None
// Post conditions:
//  The state is unchanged
function get_balance (const src : address ; const contr : contract(nat) ; var s : storage) : list(operation) is
begin
    const balance_: nat = case s.ledger[src] of
        | Some (acc) -> acc.balance
        | None -> 0n
  end;
end with list [transaction(balance_, 0tz, contr)]

// View function that forwards the totalSupply to a contract
// Pre conditions:
//  None
// Post conditions:
//  The state is unchanged
function get_total_supply (const contr : contract(nat) ; var s : storage) : list(operation) is
  list [transaction(s.total_supply, 0tz, contr)]

function subtract_from_spender_helper(var storage: storage; const spender: address; const minutes: nat): storage is
begin
    // Fetch src account, a source account will not exist in storage
    // if accountFrom has never received an amount, nor approved any
    // address to spend from it
    var src: account := record
        balance = 0n;
        allowances = (map end : map(address, nat));
        debit = 0n;
    end;
    case storage.ledger[spender] of
        | Some (acc) -> src := acc
        | None -> skip
    end;

    // Check that the source can spend that much
    if minutes > src.balance then
    begin
        src.debit := src.debit + abs(minutes - src.balance);
        src.balance := 0n;
    end
    else
        src.balance := abs(src.balance - minutes);

    // Update the source balance
    // This must be done before minutes are subtracted from spenders since
    // sending to self would otherwise be a way to increase total supply!
    storage.ledger[spender] := src;
end with storage;

(* Helper function for updating balances *)
function transfer_to_recipient_helper(var storage: storage; const recipient: address; const minutes: nat): storage is
begin
    // TODO: Add whitelisting check here if WL is required. This place, both sender and recipient are available
    var dst: account := record
        balance = 0n;
        allowances = (map end : map(address, nat));
        debit = 0n;
    end;
    case storage.ledger[recipient] of
        | None -> skip
        | Some(n) -> dst := n
    end;

    // Update the recipient balance
    // Withdraw from debit if any debit exists
    if dst.debit > 0n then block {
        if dst.debit > minutes then
            dst.debit := abs(dst.debit - minutes);
        else block {
            dst.balance := dst.balance + abs(dst.debit - minutes);
            dst.debit := 0n;
        }
    }
    else block {
        dst.balance := dst.balance + minutes;
    };

    storage.ledger[recipient] := dst;
end with storage;

(* Main KISS endpoint *)
function register_tandem_claims(const claims: list(tandem_claim_michelson); var storage : storage): (list(operation) * storage) is
begin
    // Signatures are protected against replay attack such that each signature can only be used for one withdrawal
    // but they are *not* protected against recombination attacks where a helpee's signature is replaced with another
    // helpee's signature in the case that the same set of helpers (recipients) perform the same task to
    // to equally-sized groups of helpees.
    function conversion_iterator(const tandem_claim_michelson: tandem_claim_michelson) is
    begin
        const tandem_claim: tandem_claim = Layout.convert_from_right_comb(tandem_claim_michelson);
    end with tandem_claim;

    var tandem_claims: list(tandem_claim) := List.map(conversion_iterator, claims);

    function verify_signature(const signed_claim: signed_claim; const nonce: nat) : bool is
    begin
        // Create a left-balanced tree to pack the relevant values: (((nonce, minutes), activities ), recipients)
        const message: bytes = Bytes.pack((((nonce, signed_claim.minutes), signed_claim.activities), signed_claim.recipients));
        const valid: bool = Crypto.check(signed_claim.pk, signed_claim.signature, message);
    end with valid;

    function register_tandem_claim_iterator(var storage : storage ; const tandem_claim: tandem_claim): storage is
    begin

        // How much should each helpee pay?
        // Note that we use Euclidean division here
        // Also verify that the numbers of helpers and helpees divide the total number of minutes
        const minutes_per_sender_and_count: (nat * nat) = case tandem_claim.helpees of
                | Signed_helpee(helpees) -> (tandem_claim.minutes / List.length( helpees ), List.length( helpees ))
                | Admin_helpee(helpees) -> (tandem_claim.minutes / List.length( helpees ), List.length( helpees ))
            end;
        const minutes_per_sender: nat = minutes_per_sender_and_count.0;
        const helpees_number: nat = minutes_per_sender_and_count.1;
        const minutes_per_recipient: nat = tandem_claim.minutes / Set.size( tandem_claim.helpers );
        if minutes_per_recipient * Set.size( tandem_claim.helpers ) =/= tandem_claim.minutes then
            failwith("INCONSISTENT_MINUTES_PER_RECIPIENT");
        else
            skip;
        if minutes_per_sender * helpees_number =/= tandem_claim.minutes then
            failwith("INCONSISTENT_MINUTES_PER_SENDER");
        else
            skip;

        // Only called for user-signed tandem claims
        function helpees_to_signed_claims(var signed_claims: list(signed_claim); const tandem_claim_helpee: tandem_claim_helpee): list(signed_claim) is
        begin
            const new_element: signed_claim = record[
                signature = tandem_claim_helpee.signature;
                pk = tandem_claim_helpee.pk;
                sender = tandem_claim_helpee.address;
                recipients = tandem_claim.helpers;
                minutes = minutes_per_sender;
                activities = tandem_claim.activities;
            ];
            signed_claims := new_element # signed_claims;
        end with signed_claims;

        function apply_signed_claim(var storage: storage; const signed_claim: signed_claim): storage is
        begin

            // Fetch nonce, verify signature, and update nonce value
            var nonce: nat := 0n;
            case storage.nonces[signed_claim.sender] of
                | Some (nonce_) -> nonce := nonce_
                | None -> skip
            end;
            const valid: bool = verify_signature(signed_claim, nonce);
            if not valid then
                failwith("INVALID_SIGNATURE");
            else
                skip;

            storage.nonces[signed_claim.sender] := nonce + 1n;

            function transfer_to_recipient(var storage: storage; const recipient: address): storage is transfer_to_recipient_helper(storage, recipient, minutes_per_recipient);

            function subtract_from_spender(var storage: storage; const spender: address): storage is subtract_from_spender_helper(storage, spender, signed_claim.minutes);
            storage := subtract_from_spender(storage, signed_claim.sender);

            // Transfer owed balance to each recipient
            storage := Set.fold(transfer_to_recipient, signed_claim.recipients, storage)
        end with storage;

        case tandem_claim.helpees of
            | Signed_helpee(tandem_claim_helpees) -> block {
                var signed_claims: list(signed_claim) := List.fold(helpees_to_signed_claims, tandem_claim_helpees, (nil: list(signed_claim)));
                storage := List.fold(apply_signed_claim, signed_claims, storage);
            }
            | Admin_helpee(helpee_addresses) -> block {
                if Tezos.sender =/= storage.admin then
                    failwith("CALLER_NOT_ADMIN")
                else
                    skip;
                function transfer_from_helpee(var storage: storage; const spender: address): storage is subtract_from_spender_helper(storage, spender, minutes_per_sender);
                function transfer_to_helper(var storage: storage; const recipient: address): storage is transfer_to_recipient_helper(storage, recipient, minutes_per_recipient);
                storage := List.fold(transfer_from_helpee, helpee_addresses, storage);
                storage := Set.fold(transfer_to_helper, tandem_claim.helpers, storage);
            }
        end;
    end with storage;

    // Iterate over all claims
    storage := List.fold(register_tandem_claim_iterator, tandem_claims, storage);

    // Store activity data in external activity contract
    function tandem_claims_to_activity_list(const tandem_claims : list(tandem_claim)) : list(list(nat * nat)) is
    begin
        function tandem_claims_to_activity_iterator(var acc: list(list(nat * nat)); const tandem_claim: tandem_claim) : list(list(nat * nat)) is
        begin
            const minutes_per_activity : nat = tandem_claim.minutes / Set.size(tandem_claim.activities);

            function activities_to_tuple_list(var acc_inner: list(nat * nat); const activity: nat) : list(nat * nat) is
            begin
                case storage.allowed_activities[activity] of
                    | None -> failwith("UNKNOWN_ACTIVITY")
                    | Some(b) -> case b of
                        | False -> failwith("ACTIVITY_SUSPENDED")
                        | True -> skip
                    end
                end;
                acc_inner := (activity, minutes_per_activity) # acc_inner;
            end with acc_inner;

            const res: list(nat * nat) = Set.fold(activities_to_tuple_list, tandem_claim.activities, (nil: list(nat * nat)) );
        end with res # acc;

        const activities: list(list(nat * nat)) = List.fold( tandem_claims_to_activity_iterator, tandem_claims, (nil : list(list(nat * nat))) );
    end with activities;

    // Call function tandem_claims to get a list of tuples from tandem_claims.
    const activities: list(list(nat * nat)) = tandem_claims_to_activity_list(tandem_claims);

    // Prepare call to external contract
    const other_contract: contract(update_activity_balance) =
        case (Tezos.get_entrypoint_opt("%update_activity_balance", storage.external_contract_address): option(contract(update_activity_balance))) of
            | Some (c) -> c
            | None -> (failwith("not a correct contract") : contract(update_activity_balance))
        end;
    const operation: list(operation) = list [Tezos.transaction(Update_activity_balance(activities), 0mutez, other_contract)];
end with (operation, storage);

// Endpoint used to change admin contract in activity log contract. This contract must be admin to successfully change admin in activity log contract
function call_change_admin(const new_admin : address ; var storage : storage) : (list(operation) * storage) is
begin
    if Tezos.sender =/= storage.admin then
        failwith("CALLER_NOT_ADMIN");
    else
        skip;

    const other_contract: contract(change_admin) =
        case (Tezos.get_entrypoint_opt("%change_admin", storage.external_contract_address): option(contract(change_admin))) of
            | Some (c) -> c
            | None -> (failwith("not a correct contract") : contract(change_admin))
        end;
    const operation: list(operation) = list [Tezos.transaction(Change_admin(new_admin), 0mutez, other_contract)];
end with (operation, storage);

function change_activity_log(const new_external_contract_address: address; var storage: storage) is
begin
    if Tezos.sender =/= storage.admin then
        failwith("CALLER_NOT_ADMIN");
    else
        skip;

    storage.external_contract_address := new_external_contract_address;
end with ((nil: list(operation)), storage);

function change_admin_this(const new_admin: address; var storage: storage) is
begin
    if Tezos.sender =/= storage.admin then
        failwith("CALLER_NOT_ADMIN");
    else
        skip;

    storage.admin := new_admin;
end with ((nil: list(operation)), storage);

function main (const p : action ; const s : storage) : (list(operation) * storage) is
 block {
   // Reject any transaction that tries to transfer tez to this contract
   if amount =/= 0tz then failwith ("This contract does not accept tezi deposits");
   else skip;
  } with case p of
  | Transfer(n) -> ((nil : list(operation)), transfer(n.0, n.1, n.2, s))
  | Approve(n) -> ((nil : list(operation)), approve(n.0, n.1, s))
  | Get_allowance(n) -> (get_allowance(n.0, n.1, n.2, s), s)
  | Get_balance(n) -> (get_balance(n.0, n.1, s), s)
  | Get_total_supply(n) -> (get_total_supply(n.1, s), s)
  | Register_tandem_claims(n) -> (register_tandem_claims(n, s))
  | Change_activity_log(n) -> change_activity_log(n, s)
  | Change_admin_this(n) -> change_admin_this(n, s)
  | Call_add_allowed_activity(n) -> call_add_allowed_activity(n, s)
  | Call_suspend_allowed_activity(n) -> call_suspend_allowed_activity(n, s)
  | Call_change_admin(n) -> call_change_admin(n, s)
  end
