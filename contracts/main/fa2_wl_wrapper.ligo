type storage is address

type action is
| Method of address
| Store_result of address

// Input argument to the function being wrapped
type parameter is address

// Type of action called on external contract
type x is Token_metadata_registry of contract(address);

function store_result (const response_address: address; const storage: storage) : (list(operation) * storage) is
begin
    const ret_storage : storage = response_address;
end with ((nil: list(operation)), ret_storage)

function method (const contract_address: address; const storage: storage) : (list(operation) * storage) is
begin
    const other_contract: contract(x) =
    case (Tezos.get_entrypoint_opt("%token_metadata_registry", contract_address): option(contract(x))) of
      | Some (c) -> c
      | None -> (failwith("not a correct contract") : contract(x))
    end;

    // Some object that represents this contract
    const self_contract : contract(address) = Tezos.self("%store_result");
    const result: (list(operation) * storage) = ((list [Tezos.transaction(Token_metadata_registry(self_contract), 0mutez, other_contract)]: list(operation)), storage)
end with result

function main (const action: action; const storage: storage): (list(operation) * storage) is
  (case action of
  | Method(addr) -> method(addr, storage)
  | Store_result(addr) -> store_result(addr, storage)
  end)
