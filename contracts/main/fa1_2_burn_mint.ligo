#include "../partials/fa1_2_types.ligo"

type action is
| Transfer of michelson_pair(address, "from", michelson_pair(address, "to", nat, "value"), "")
| Approve of michelson_pair(address, "spender", nat, "value")
| GetBalance of michelson_pair(address, "owner", contract(nat), "")
| GetAllowance of michelson_pair(michelson_pair(address, "owner", address, "spender"), "", contract(nat), "")
| GetTotalSupply of (unit * contract(nat))
| Mint of (address * nat)
| Burn of nat

type storage is record
  ledger: big_map(address, account);
  total_supply: nat;
  minter: address;
end

function transfer_allowed(const from_ : address ; const to_ : address ; const storage : storage) : unit is Unit;

#include "../partials/fa1_2_base.ligo"

// Only minter can mint. Minter can mint any amount to any address
function mint (const recipient : address ; const value : nat ; var storage : storage) : storage is
begin
    if Tezos.sender =/= storage.minter then failwith("ONLY_MINTER_CAN_MINT");
    else skip;

    var recipient_account: account := record
        balance = 0n;
        allowances = (map end : map(address, nat));
    end;
    case storage.ledger[recipient] of
        Some(acc) -> recipient_account := acc
        | None -> skip
    end;
    recipient_account.balance := recipient_account.balance + value;
    storage.ledger[recipient] := recipient_account;
    storage.total_supply := storage.total_supply + value
end with storage

// Anyone can burn up to their own balance
function burn (const value: nat; var storage : storage) : storage is
begin
    var burner_account: account := case storage.ledger[Tezos.sender] of
        Some(acc) -> acc
        | None -> (failwith("NO_ACCOUNT") : account)
    end;

    // Verify that balance is sufficient to burn
    if value > burner_account.balance
    then failwith ("NotEnoughBalance");
    else skip;

    burner_account.balance := abs(burner_account.balance - value);
    storage.ledger[Tezos.sender] := burner_account;
    storage.total_supply := abs(storage.total_supply - value);
end with storage

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
  | Mint(n) -> ((nil : list(operation)), mint(n.0, n.1, s))
  | Burn(n) -> ((nil : list(operation)), burn(n, s))
  end
