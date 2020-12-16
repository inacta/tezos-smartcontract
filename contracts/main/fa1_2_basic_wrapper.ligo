// This needs to handle three endpoints in the FA1.2 interface:
// GetAllowance, GetBalance, and GetTotalSupply
// Each needs two endpoints, one to call the FA1.2 endpoint,
// and receive the callback from the FA1.2 contract

type action is
| Call_get_allowance of (address * address * address)
| Call_get_balance of (address * address)
| Call_get_total_supply of (address)
| Store_allowance of nat
| Store_balance of nat
| Store_total_supply of nat

// External actions
type get_allowance_action is GetAllowance of michelson_pair(michelson_pair(address, "owner", address, "spender"), "", contract(nat), "");
type get_balance_action is GetBalance of michelson_pair(address, "owner", contract(nat), "");
type get_total_supply_action is GetTotalSupply of (unit * contract(nat));

type storage is record
    allowance_response : nat;
    balance_response: nat;
    total_supply_response: nat;
end;

function store_balance(const balance_response : nat; const storage: storage) : (list(operation) * storage) is
begin
    // We simply overwrite (not append) all the responses for each callback
    storage.balance_response := balance_response;
end with ((nil: list(operation)), storage)

function store_allowance(const allowance : nat; const storage: storage) : (list(operation) * storage) is
begin
    // We simply overwrite (not append) all the responses for each callback
    storage.allowance_response := allowance;
end with ((nil: list(operation)), storage)

function store_total_supply(const total_supply : nat; const storage: storage) : (list(operation) * storage) is
begin
    // We simply overwrite (not append) all the responses for each callback
    storage.total_supply_response := total_supply;
end with ((nil: list(operation)), storage)

function call_get_allowance(const owner: address; const spender: address; const contract_address: address; const storage: storage) : (list(operation) * storage) is
begin
    const other_contract: contract(get_allowance_action) =
    case (Tezos.get_entrypoint_opt("%getAllowance", contract_address): option(contract(get_allowance_action))) of
      | Some (c) -> c
      | None -> (failwith("not a correct contract") : contract(get_allowance_action))
    end;

    // The endpoint get_allowance takes a triplet of address * address * contract(nat)
    const self_contract : contract(nat) = Tezos.self("%store_allowance");
    const argument: michelson_pair(michelson_pair(address, "owner", address, "spender"), "", contract(nat), "") = ((owner, spender), self_contract);
    const result: (list(operation) * storage) =
    ((list [Tezos.transaction(GetAllowance(argument), 0mutez, other_contract)]: list(operation)), storage);
end with result

function call_get_balance(const owner: address; const contract_address: address; const storage: storage) : (list(operation) * storage) is
begin
    const other_contract: contract(get_balance_action) =
    case (Tezos.get_entrypoint_opt("%getBalance", contract_address): option(contract(get_balance_action))) of
      | Some (c) -> c
      | None -> (failwith("not a correct contract") : contract(get_balance_action))
    end;

    // The endpoint get_balance takes a tuple of address * contract(nat)
    const self_contract : contract(nat) = Tezos.self("%store_balance");
    const argument: michelson_pair(address, "owner", contract(nat), "") = (owner, self_contract);
    const result: (list(operation) * storage) =
    ((list [Tezos.transaction(GetBalance(argument), 0mutez, other_contract)]: list(operation)), storage);
end with result

function call_get_total_supply(const contract_address: address; const storage: storage) : (list(operation) * storage) is
begin
    const other_contract: contract(get_total_supply_action) =
    case (Tezos.get_entrypoint_opt("%getTotalSupply", contract_address): option(contract(get_total_supply_action))) of
      | Some (c) -> c
      | None -> (failwith("not a correct contract") : contract(get_total_supply_action))
    end;

    // The endpoint get_total_supple takes an argument of type contract(nat)
    const self_contract : contract(nat) = Tezos.self("%store_total_supply");
    const argument: (unit * contract(nat)) = (Unit, self_contract);
    const result: (list(operation) * storage) =
    ((list [Tezos.transaction(GetTotalSupply(argument), 0mutez, other_contract)]: list(operation)), storage);
end with result

function main (const action: action; const s: storage): (list(operation) * storage) is
  (case action of
  | Call_get_allowance(n) -> call_get_allowance(n.0, n.1, n.2, s)
  | Call_get_balance(n) -> call_get_balance(n.0, n.1, s)
  | Call_get_total_supply(addr) -> call_get_total_supply(addr, s)
  | Store_allowance(param) -> store_allowance(param, s)
  | Store_balance(addr) -> store_balance(addr, s)
  | Store_total_supply(supply) -> store_total_supply(supply, s)
  end)
