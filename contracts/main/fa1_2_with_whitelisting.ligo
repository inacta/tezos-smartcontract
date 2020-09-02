#include "../partials/fa1_2_types.ligo"

(***** Update_whitelisters types *****)
type update_whitelisters_add_or_remove is
| Add_whitelister of address
| Remove_whitelister of address
type update_whitelisters_add_or_remove_michelson is michelson_or_right_comb(update_whitelisters_add_or_remove);
type update_whitelisters_parameter is list(update_whitelisters_add_or_remove_michelson);

type update_whitelisteds_add_or_remove is
| Add_whitelisted of address
| Remove_whitelisted of address
type update_whitelisteds_add_or_remove_michelson is michelson_or_right_comb(update_whitelisteds_add_or_remove);
type update_whitelisteds_parameter is list(update_whitelisteds_add_or_remove_michelson);

type action is
| Transfer of (address * address * nat)
| Approve of (address * nat)
| Get_allowance of (address * address * contract(nat))
| Get_balance of (address * contract(nat))
| Get_total_supply of (unit * contract(nat))
| Set_non_revocable_wl_admin of address
| Add_wl_admin of address
| Renounce_wl_admin
| Update_whitelisters of update_whitelisters_parameter
| Update_whitelisteds of update_whitelisteds_parameter

type storage is record
  ledger: big_map(address, account);
  total_supply: nat;
  whitelisteds: set (address);
  whitelisters: set (address);
  whitelist_admins: set (address);
  non_revocable_whitelist_admin: address
end

function transfer_allowed(const from_ : address ; const to_ : address ; const storage : storage) : unit is
begin
    if not (storage.whitelisteds contains from_) then failwith("SENDER_NOT_WHITELISTED")
    else skip;
    if not (storage.whitelisteds contains to_) then failwith("RECEIVER_NOT_WHITELISTED")
    else skip;
end with Unit;

#include "../partials/fa1_2_base.ligo"

(***** UPDATE WHITELISTEDS *****)
function update_whitelisteds(const update_whitelisteds_parameter: update_whitelisteds_parameter ; var storage: storage) : (list(operation) * storage) is
begin
    function update_whitelisteds_iterator (var storage: storage; const update_whitelisteds_add_or_remove_michelson: update_whitelisteds_add_or_remove_michelson): storage is
    begin
        function update_whitelisteds ( var storage: storage; const whitelisted: address ; const add: bool): storage is
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

    // We do not check if the address is already whitelisted/already removed.
    if not (storage.whitelisters contains Tezos.sender) then failwith("ONLY_WHITELISTERS_CAN_UPDATE_WHITELISTEDS")
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

    if not (storage.whitelist_admins contains Tezos.sender) then failwith("ONLY_WHITELIST_ADMIN_CAN_UPDATE_WHITELISTERS")
    else skip;
    storage := List.fold(update_whitelisters_iterator, update_whitelisters_parameter, storage);
end with ((nil: list(operation)), storage);

#include "../partials/whitelist_admin.ligo"

function main (const p : action ; const storage : storage) : (list(operation) * storage) is
 block {
   // Reject any transaction that tries to transfer token to this contract
   if amount =/= 0tz then failwith ("This contract does not accept tezi deposits");
   else skip;
  } with case p of
  | Transfer(n) -> ((nil : list(operation)), transfer(n.0, n.1, n.2, storage))
  | Approve(n) -> ((nil : list(operation)), approve(n.0, n.1, storage))
  | Get_allowance(n) -> (get_allowance(n.0, n.1, n.2, storage), storage)
  | Get_balance(n) -> (get_balance(n.0, n.1, storage), storage)
  | Get_total_supply(n) -> (get_total_supply(n.1, storage), storage)
  | Set_non_revocable_wl_admin(new_non_revocable_whitelist_admin) -> set_non_revocable_wl_admin(new_non_revocable_whitelist_admin, storage)
  | Add_wl_admin(new_whitelist_admin) -> add_wl_admin(new_whitelist_admin, storage)
  | Renounce_wl_admin -> renounce_wl_admin(storage)
  | Update_whitelisters(update_whitelisters_parameter) -> update_whitelisters(update_whitelisters_parameter, storage)
  | Update_whitelisteds(update_whitelisteds_parameter) -> update_whitelisteds(update_whitelisteds_parameter, storage)
  end
