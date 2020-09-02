#include "../partials/fa2_types.ligo"

type whitelisteds is big_map(address, set(nat));

(***** Update_whitelisters types *****)
type update_whitelisters_add_or_remove is
| Add_whitelister of address
| Remove_whitelister of address
type update_whitelisters_add_or_remove_michelson is michelson_or_right_comb(update_whitelisters_add_or_remove);
type update_whitelisters_parameter is list(update_whitelisters_add_or_remove_michelson);


(***** Update_whitelisteds types *****)
type whitelist_element is record
    address: address;
    token_id: token_id;
end;
type update_whitelisteds_add_or_remove is
| Add_whitelisted of whitelist_element
| Remove_whitelisted of whitelist_element
// update_whitelisteds_add_or_remove is an algebraic datatype, so we convert that to some input
// expressable type through michelson_or_right_comb
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

type storage is record
    ledger: ledger;
    token_metadata: big_map(token_id, token_metadata);
    whitelisteds: whitelisteds;
    whitelisters: set (address);
    whitelist_admins: set (address);
    non_revocable_whitelist_admin: address
end;

function transfer_allowed(const from_ : address ; const to_ : address ; const token_id: token_id; const storage : storage) : unit is
begin
    case storage.whitelisteds[from_] of
        | Some(token_ids) -> if (token_ids contains token_id) then skip else failwith ("FA2_SENDER_NOT_WHITELISTED")
        | None -> failwith ("FA2_SENDER_NOT_WHITELISTED")
    end;
    case storage.whitelisteds[to_] of
        | Some(token_ids) -> if (token_ids contains token_id) then skip else failwith ("FA2_RECEIVER_NOT_WHITELISTED")
        | None -> failwith ("FA2_RECEIVER_NOT_WHITELISTED")
    end;
end with Unit;

#include "../partials/fa2_base.ligo"

(***** UPDATE WHITELISTEDS *****)
function update_whitelisteds(const update_whitelisteds_parameter: update_whitelisteds_parameter ; var storage: storage) : (list(operation) * storage) is
begin
    function update_whitelisteds_iterator (var storage: storage; const update_whitelisteds_add_or_remove_michelson: update_whitelisteds_add_or_remove_michelson): storage is
    begin
        function update_whitelisteds ( var storage: storage; const whitelist_element: whitelist_element ; const add: bool): storage is
        begin
            var whitelisteds: big_map(address, set(nat)) := storage.whitelisteds;
            if add then block {
                // check if address is already a key in the big_map(address, set(nat)) mapping
                whitelisteds[whitelist_element.address] := case whitelisteds[whitelist_element.address] of
                    | Some(token_ids) -> Set.add(whitelist_element.token_id, token_ids)
                    | None -> (set [whitelist_element.token_id]: set(nat))
                end;
            };
            else block {
                whitelisteds[whitelist_element.address] := case whitelisteds[whitelist_element.address] of
                    | Some(token_ids) -> Set.remove(whitelist_element.token_id, token_ids)
                    | None -> (set []: set(nat))
                end;
            };

            storage.whitelisteds := whitelisteds;

        end with storage;

        const update_whitelisteds_add_or_remove: update_whitelisteds_add_or_remove = Layout.convert_from_right_comb(update_whitelisteds_add_or_remove_michelson);
        const ret: storage = case update_whitelisteds_add_or_remove of
            | Add_whitelisted(whitelist_element) -> update_whitelisteds(storage, whitelist_element, True)
            | Remove_whitelisted(whitelist_element) -> update_whitelisteds(storage, whitelist_element, False)
        end
    end with ret;

    // We do not check if the address is already whitelisted/already removed. This functionality
    // mimics the function to update operators
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

#include "../partials/whitelist_admin.ligo"

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
