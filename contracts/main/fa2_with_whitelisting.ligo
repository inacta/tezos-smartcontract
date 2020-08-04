(***** Shared types *****)
type token_owner is address;

 // If changing contract to handle multiple assets, add token_id to token_lookup_id
type token_lookup_id is token_owner;
type token_balance is nat;

type account is record
    balance : token_balance;
    allowances: set (address);
end
type ledger is big_map(token_owner, account);
type token_id is nat;
type token_metadata is record
    token_id: token_id;
    symbol: string;
    name: string;
    decimals: nat;
    extras: map(string, string);
end
type storage is record
    ledger: ledger;
    token_metadata: big_map(token_id, token_metadata);
    whitelisteds: set (address);
    whitelisters: set (address);
    whitelist_admins: set (address);
    non_revocable_whitelist_admin: address
end;

type token_id is nat;


(***** Transfer types *****)
type transfer_to is record
    token_id : token_id;
    amount : token_balance;
    to_ : token_owner;
end;

type transfer_to_michelson is michelson_pair_right_comb(transfer_to);

type transfer_from is record
    from_ : token_owner;
    txs: list(transfer_to_michelson);
end;

type transfer_from_michelson is michelson_pair_right_comb(transfer_from);

type transfer_param is list(transfer_from_michelson);

(***** Balance_of types *****)
type balance_of_request is record
    owner: token_owner;
    token_id: token_id;
end;

type balance_of_response is record
    request: balance_of_request;
    balance: token_balance;
end;

type balance_of_callback is contract(list(balance_of_response));

type balance_of_parameter is record
    requests: list(balance_of_request);
    callback: balance_of_callback;
end;

type balance_of_request_michelson is michelson_pair_right_comb(balance_of_request);

type balance_of_response_auxiliary is record [
    balance: token_balance;
    request: balance_of_request_michelson;
]

type balance_of_response_michelson is michelson_pair_right_comb(balance_of_response_auxiliary);

type balance_of_callback_michelson is contract(list(balance_of_response_michelson));

type balance_of_parameter_auxiliary is record [
    requests: list(balance_of_request_michelson);
    callback: balance_of_callback_michelson;
]

type balance_of_parameter_michelson is michelson_pair_right_comb(balance_of_parameter_auxiliary);


(***** Update_operators types *****)
type token_operator is address;

type operator_parameter is record [
    owner: token_owner;
    operator: token_operator;
]

type update_operators_add_or_remove is
// There's an extra `_p` in the constructors below to avoid 'redundant constructor' error
// due to the interop type conversions below
// Type constructors have to start with capital letters
| Add_operator_p of operator_parameter
| Remove_operator_p of operator_parameter

type operator_parameter_michelson is michelson_pair_right_comb(operator_parameter);

type update_operators_add_or_remove_auxiliary is
| Add_operator of operator_parameter_michelson
| Remove_operator of operator_parameter_michelson

type update_operators_add_or_remove_michelson is michelson_or_right_comb(update_operators_add_or_remove_auxiliary);

type update_operators_parameter is list(update_operators_add_or_remove_michelson);


(***** Token_metadata_registry types *****)
type token_metadata_registry_target is address;
type token_metadata_registry_parameter is contract(token_metadata_registry_target);


(***** Update_whitelisters types *****)
type update_whitelisters_add_or_remove is
| Add_whitelister of address
| Remove_whitelister of address
type update_whitelisters_add_or_remove_michelson is michelson_or_right_comb(update_whitelisters_add_or_remove);
type update_whitelisters_parameter is list(update_whitelisters_add_or_remove_michelson);


(***** Update_whitelisteds types *****)
type update_whitelisteds_add_or_remove is
| Add_whitelisted of address
| Remove_whitelisted of address
type update_whitelisteds_add_or_remove_michelson is michelson_or_right_comb(update_whitelisteds_add_or_remove);
type update_whitelisteds_parameter is list(update_whitelisteds_add_or_remove_michelson);


(***** actions -- defines available endpoints *****)
// The abreviation 'wl' for whitelist is used since Tezos limits type constructors to
// a maximum length of 32 charactes
type action is
| Transfer of transfer_param
| Balance_of of balance_of_parameter_michelson
| Update_operators of update_operators_parameter
| Token_metadata_registry of token_metadata_registry_parameter
| Set_non_revocable_wl_admin of address
| Add_wl_admin of address
| Renounce_wl_admin
| Update_whitelisters of update_whitelisters_parameter
| Update_whitelisteds of update_whitelisteds_parameter


function transfer_allowed(const from_ : address ; const to_ : address ; const storage : storage) : unit is
begin
    if not (storage.whitelisteds contains from_) then failwith ("FA2_SENDER_NOT_WHITELISTED") else skip;
    if not (storage.whitelisteds contains to_) then failwith ("FA2_RECEIVER_NOT_WHITELISTED") else skip;
end with Unit;

#include "../partials/fa2_base.ligo"

(***** UPDATE WHITELISTEDS *****)
function update_whitelisteds(const update_whitelisteds_parameter: update_whitelisteds_parameter ; var storage: storage) : (list(operation) * storage) is
begin
    function update_whitelisteds_iterator (var storage: storage; var update_whitelisteds_add_or_remove_michelson: update_whitelisteds_add_or_remove_michelson): storage is
    begin
        function update_whitelisteds ( var storage: storage; var whitelisted: address ; const add: bool): storage is
        begin
            var whitelisteds: set(address) := storage.whitelisteds;
            if add then block {
                whitelisteds := Set.add(whitelisted, whitelisteds);
            };
            else block {
                whitelisteds := Set.remove(whitelisted, whitelisteds);
            };

            storage.whitelisteds := whitelisteds;

        end with storage;

        const update_whitelisteds_add_or_remove: update_whitelisteds_add_or_remove = Layout.convert_from_right_comb(update_whitelisteds_add_or_remove_michelson);
        const ret: storage = case update_whitelisteds_add_or_remove of
            | Add_whitelisted(whitelisted) -> update_whitelisteds(storage, whitelisted, True)
            | Remove_whitelisted(whitelisted) -> update_whitelisteds(storage, whitelisted, False)
        end
    end with ret;

    // TODO: We do not check if the address is already whitelisted/already removed. Should we do that and throw an error if it is?
    if not (storage.whitelisters contains Tezos.sender) then failwith("FA2_ONLY_WHITELISTERS_CAN_UPDATE_WHITELISTEDS")
    else skip;

    storage := List.fold(update_whitelisteds_iterator, update_whitelisteds_parameter, storage);

end with ((nil: list(operation)), storage);


(***** UPDATE WHITELISTERS *****)
function update_whitelisters(const update_whitelisters_parameter: update_whitelisters_parameter ; var storage: storage) : (list(operation) * storage) is
begin
    function update_whitelisters_iterator (var storage: storage; var update_whitelisters_add_or_remove_michelson: update_whitelisters_add_or_remove_michelson): storage is
    begin
        function update_whitelisters ( var storage: storage; var whitelister: address ; const add: bool): storage is
        begin
            // TODO: We do not check if the address is already whitelisted/already removed. Should we do that and throw an error if it is?
            var whitelisters: set(address) := storage.whitelisters;
            if add then block {
                whitelisters := Set.add(whitelister, whitelisters);
            };
            else block {
                whitelisters := Set.remove(whitelister, whitelisters);
            };

            storage.whitelisters := whitelisters;
        end with storage;

        const update_whitelisters_add_or_remove: update_whitelisters_add_or_remove = Layout.convert_from_right_comb(update_whitelisters_add_or_remove_michelson);
        const ret: storage = case update_whitelisters_add_or_remove of
            | Add_whitelister(whitelister) -> update_whitelisters(storage, whitelister, True)
            | Remove_whitelister(whitelister) -> update_whitelisters(storage, whitelister, False)
        end
    end with ret;

    if not (storage.whitelist_admins contains Tezos.sender) then failwith("FA2_ONLY_WHITELIST_ADMIN_CAN_UPDATE_WHITELISTERS")
    else skip;
    storage := List.fold(update_whitelisters_iterator, update_whitelisters_parameter, storage);

end with ((nil: list(operation)), storage);


(***** UPDATE WHITELIST ADMINS *****)
// Replace the existing non-revocable whitelist admin with a new
// We do not verify that the existing non-revocable whitelist admin
// is a whitelist admin as the contract could otherwise be initiated
// with a non-revocable whitelist admin that was not a whitelist admin
// and in this case, the non-revocable role could not be rescinded
// Since we don't have access to a controller where the above logic
// can be implemented, this was best solution I could come up with
function set_non_revocable_wl_admin(const new_non_revocable_whitelist_admin: address; var storage: storage): (list(operation) * storage) is
begin
    // We use Tezos.sender as this is the user or contract making this call.
    // Using Tezos.source would always be a user since Tezos.source is the transaction
    // originator, and the call to this contract could have gone through another contract,
    // so using Tezos.sender allows the non_revocable_whitelist_admin to be a contract
    if Tezos.sender =/= storage.non_revocable_whitelist_admin then failwith("FA2_NOT_NON_REVOCABLE_WHITELIST_ADMIN")
    else skip;

    // Ensure that the new non_revocable_whitelist_admin is already a whitelist_admin
    if not (storage.whitelist_admins contains new_non_revocable_whitelist_admin) then failwith("FA2_NEW_NON_REVOCABLE_WHITELIST_ADMIN_NOT_WHITELIST_ADMIN")
    else skip;

    // Don't allow function call if it does not affect state
    if new_non_revocable_whitelist_admin = storage.non_revocable_whitelist_admin then failwith("FA2_CALLER_CANNOT_HAND_NON_REVOCABLE_WHITELIST_ADMIN_TO_SELF")
    else skip;

    storage.non_revocable_whitelist_admin := new_non_revocable_whitelist_admin;
end with ((nil: list(operation)), storage);

// Add a new whitelist admin. The only requirement is that caller is admin
// This operation is idempotent so we don't check if the new admin is already an admin
function add_wl_admin(const new_whitelist_admin: address; const storage: storage): (list(operation) * storage) is
begin
    // Only whitelist admins can add other whitelist admins
    if not (storage.whitelist_admins contains Tezos.sender) then failwith("FA2_ONLY_WHITELIST_ADMIN_CAN_ADD_WHITELIST_ADMINS")
    else skip;

    var whitelist_admins: set(address) := storage.whitelist_admins;
    const new_whitelist_admins: set(address) = Set.add(new_whitelist_admin, whitelist_admins);
    storage.whitelist_admins := new_whitelist_admins;
end with ((nil: list(operation)), storage);

function renounce_wl_admin(const storage: storage): (list(operation) * storage) is
begin
    // Ensure that the non-revocable role does not call this method
    if Tezos.sender = storage.non_revocable_whitelist_admin then failwith("FA2_CALLER_IS_NON_REVOCABLE_WHITELIST_ADMIN")
    else skip;

    // TODO: What happens if we attempt to move something that isn't there?
    var whitelist_admins: set(address) := storage.whitelist_admins;
    const new_whitelist_admins: set(address) = Set.remove(Tezos.sender, whitelist_admins);
    storage.whitelist_admins := new_whitelist_admins;
end with ((nil: list(operation)), storage);


(***** MAIN FUNCTION *****)
(* Default function that represents our contract, it's sole purpose here is the entrypoint routing *)
function main (const action : action; var storage : storage) : (list(operation) * storage) is
begin
    if amount =/= 0tz then failwith("This contract does not accept tezi deposits")
    else skip;
end with case action of
    | Transfer(transfer_param) -> transfer(transfer_param, storage)
    | Balance_of(balance_of_parameter_michelson) -> balance_of(balance_of_parameter_michelson, storage)
    | Update_operators(update_operators_parameter) -> update_operators(update_operators_parameter, storage)
    | Token_metadata_registry(token_metadata_registry_parameter) -> token_metadata_registry(token_metadata_registry_parameter, storage)
    | Set_non_revocable_wl_admin(new_non_revocable_whitelist_admin) -> set_non_revocable_wl_admin(new_non_revocable_whitelist_admin, storage)
    | Add_wl_admin(new_whitelist_admin) -> add_wl_admin(new_whitelist_admin, storage)
    | Renounce_wl_admin -> renounce_wl_admin(storage)
    | Update_whitelisters(update_whitelisters_parameter) -> update_whitelisters(update_whitelisters_parameter, storage)
    | Update_whitelisteds(update_whitelisteds_parameter) -> update_whitelisteds(update_whitelisteds_parameter, storage)
    end
