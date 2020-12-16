#include "../partials/fa1_2_types.ligo"

type action is
| Transfer of michelson_pair(address, "from", michelson_pair(address, "to", nat, "value"), "")
| Approve of michelson_pair(address, "spender", nat, "value")
| GetBalance of michelson_pair(address, "owner", contract(nat), "")
| GetAllowance of michelson_pair(michelson_pair(address, "owner", address, "spender"), "", contract(nat), "")
| GetTotalSupply of (unit * contract(nat))

type storage is record
  ledger: big_map(address, account);
  total_supply: nat;
end

function transfer_allowed(const from_ : address ; const to_ : address ; const storage : storage) : unit is Unit;

#include "../partials/fa1_2_base.ligo"

function main (const p : action ; const s : storage) :
  (list(operation) * storage) is
 block {
   // Reject any transaction that tries to transfer token to this contract
   if amount =/= 0tz then failwith ("This contract does not accept tezi deposits");
   else skip;
  } with case p of
  | Transfer(n) -> ((nil : list(operation)), transfer(n.0, n.1.0, n.1.1, s))
  | Approve(n) -> ((nil : list(operation)), approve(n.0, n.1, s))
  | GetBalance(n) -> (get_balance(n.0, n.1, s), s)
  | GetAllowance(n) -> (get_allowance(n.0.0, n.0.1, n.1, s), s)
  | GetTotalSupply(n) -> (get_total_supply(n.1, s), s)
  end
