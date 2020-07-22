// Type of actions called on external contract
// Token_metadata_registry endpoint
type token_metadata_registry_action is Token_metadata_registry of contract(address);

// Balance_of endpoint
type token_id is nat;
type token_owner is address;
type token_balance is nat;

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

type balance_of_wrapper is record
    request: list(balance_of_request_michelson);
    contract_address: address;
end;

type balance_of_action is Balance_of of balance_of_parameter_michelson;

type storage is record
    tmr_response : address;
    balance_responses: list(balance_of_response_michelson);
end;

// Actions are possible entrypoints of this contract
type action is
| Call_balance_of of balance_of_wrapper
| Call_token_metadata_registry of address
| Store_balance_of of list(balance_of_response_michelson)
| Store_token_metadata_registry of address

// Task: convert from balance_of_wrapper to balance_of_parameter_michelson
// The field request of type list(balance_of_request_michelson) of the input
// matches the type of the field "requests" of the type balance_of_parameter_auxiliary.
// So we should be able to construct the balance_of_parameter_auxiliary value since this is
// a record and we have both fields.
function call_balance_of(const balance_of_wrapper: balance_of_wrapper; const storage: storage ) : (list(operation) * storage) is
begin
    const other_contract: contract(balance_of_action) =
    case (Tezos.get_entrypoint_opt("%balance_of", balance_of_wrapper.contract_address): option(contract(balance_of_action))) of
      | Some (c) -> c
      | None -> (failwith("not a correct contract") : contract(balance_of_action))
    end;

    // balance_of_wrapper contains two fields: the address and the list of balance requests
    // We need to construct a balance_of_parameter_michelson structure
    const self_contract : contract(list(balance_of_response_michelson)) = Tezos.self("%store_balance_of");
    const balance_of_requests_michelson: list(balance_of_request_michelson) = balance_of_wrapper.request;
    const balance_of_parameter_auxiliary: balance_of_parameter_auxiliary = record[
        requests = balance_of_requests_michelson;
        callback = self_contract;
    ];

    // We need to convert the record to a michelson datatype
    const balance_of_parameter_michelson: balance_of_parameter_michelson = Layout.convert_to_left_comb((balance_of_parameter_auxiliary: balance_of_parameter_auxiliary));

    const result: (list(operation) * storage) = ((list [Tezos.transaction(Balance_of(balance_of_parameter_michelson), 0mutez, other_contract)]: list(operation)), storage);
end with result
//end with ((nil: list(operation)), storage)

// Callback function called upon correct call to balance_of
function store_balance_of(const balance_responses : list(balance_of_response_michelson); const storage: storage) : (list(operation) * storage) is
begin
    // We simply overwrite (not append) all the responses for each callback
    storage.balance_responses := balance_responses;
end with ((nil: list(operation)), storage)

function store_token_metadata_registry (const response_address: address; const storage: storage) : (list(operation) * storage) is
begin
    storage.tmr_response := response_address;
end with ((nil: list(operation)), storage)

function call_token_metadata_registry (const contract_address: address; const storage: storage) : (list(operation) * storage) is
begin
    const other_contract: contract(token_metadata_registry_action) =
    case (Tezos.get_entrypoint_opt("%token_metadata_registry", contract_address): option(contract(token_metadata_registry_action))) of
      | Some (c) -> c
      | None -> (failwith("not a correct contract") : contract(token_metadata_registry_action))
    end;

    // Some object that represents this contract and the correct endpoint
    const self_contract : contract(address) = Tezos.self("%store_token_metadata_registry");
    const result: (list(operation) * storage) = ((list [Tezos.transaction(Token_metadata_registry(self_contract), 0mutez, other_contract)]: list(operation)), storage);
end with result;

function main (const action: action; const storage: storage): (list(operation) * storage) is
  (case action of
  | Call_balance_of(balance_of_wrapper) -> call_balance_of(balance_of_wrapper, storage)
  | Call_token_metadata_registry(addr) -> call_token_metadata_registry(addr, storage)
  | Store_balance_of(param) -> store_balance_of(param, storage)
  | Store_token_metadata_registry(addr) -> store_token_metadata_registry(addr, storage)
  end)
