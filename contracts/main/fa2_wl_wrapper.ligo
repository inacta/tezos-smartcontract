type storage is record
    tmr_response : address;
    unit_value: unit;
end;

type action is
| Call_token_metadata_registry of address
| Store_token_metadata_registry of address

// Input argument to the function being wrapped
type parameter is address

// Type of action called on external contract
type x is Token_metadata_registry of contract(address);

function store_token_metadata_registry (const response_address: address; const storage: storage) : (list(operation) * storage) is
begin
    storage.tmr_response := response_address;
end with ((nil: list(operation)), storage)

function call_token_metadata_registry (const contract_address: address; const storage: storage) : (list(operation) * storage) is
begin
    const other_contract: contract(x) =
    case (Tezos.get_entrypoint_opt("%token_metadata_registry", contract_address): option(contract(x))) of
      | Some (c) -> c
      | None -> (failwith("not a correct contract") : contract(x))
    end;

    // Some object that represents this contract
    const self_contract : contract(address) = Tezos.self("%store_token_metadata_registry");
    const result: (list(operation) * storage) = ((list [Tezos.transaction(Token_metadata_registry(self_contract), 0mutez, other_contract)]: list(operation)), storage)
end with result

function main (const action: action; const storage: storage): (list(operation) * storage) is
  (case action of
  | Call_token_metadata_registry(addr) -> call_token_metadata_registry(addr, storage)
  | Store_token_metadata_registry(addr) -> store_token_metadata_registry(addr, storage)
  end)
