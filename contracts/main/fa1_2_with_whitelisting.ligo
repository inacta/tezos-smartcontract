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
| Transfer of michelson_pair(address, "from", michelson_pair(address, "to", nat, "value"), "")
| Approve of michelson_pair(address, "spender", nat, "value")
| GetBalance of michelson_pair(address, "owner", contract(nat), "")
| GetAllowance of michelson_pair(michelson_pair(address, "owner", address, "spender"), "", contract(nat), "")
| GetTotalSupply of (unit * contract(nat))
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

#include "../partials/universal_whitelisting.ligo"

#include "../partials/whitelist_admin.ligo"

function main (const p : action ; const storage : storage) : (list(operation) * storage) is
 block {
   // Reject any transaction that tries to transfer token to this contract
   if amount =/= 0tz then failwith ("This contract does not accept tezi deposits");
   else skip;
  } with case p of
  | Transfer(n) -> ((nil : list(operation)), transfer(n.0, n.1.0, n.1.1, storage))
  | Approve(n) -> ((nil : list(operation)), approve(n.0, n.1, storage))
  | GetBalance(n) -> (get_balance(n.0, n.1, storage), storage)
  | GetAllowance(n) -> (get_allowance(n.0.0, n.0.1, n.1, storage), storage)
  | GetTotalSupply(n) -> (get_total_supply(n.1, storage), storage)
  | Set_non_revocable_wl_admin(new_non_revocable_whitelist_admin) -> set_non_revocable_wl_admin(new_non_revocable_whitelist_admin, storage)
  | Add_wl_admin(new_whitelist_admin) -> add_wl_admin(new_whitelist_admin, storage)
  | Renounce_wl_admin -> renounce_wl_admin(storage)
  | Update_whitelisters(update_whitelisters_parameter) -> update_whitelisters(update_whitelisters_parameter, storage)
  | Update_whitelisteds(update_whitelisteds_parameter) -> update_whitelisteds(update_whitelisteds_parameter, storage)
  end
