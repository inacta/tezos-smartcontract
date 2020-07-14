(* Storage type for the tzip-12 tutorial smart contract *)
(* Alias types to new names for better readability *)
type token_owner is address;
type token_lookup_id is token_owner; // If changing contract to handle multiple assets,
type token_balance is nat;

type account is record
    balance : token_balance;
    allowances: set (address);
end
type ledger is big_map(token_owner, account);
type storage is record
    ledger: ledger;
end;

type token_id is nat;

// Transfer types
type transfer is record
    token_id : token_id;
    amount : token_balance;
    from_ : token_owner;
    to_ : token_owner;
end;

type transfer_param is list(transfer);

// Balance_of types
type balance_of_request is record
    owner: token_owner;
    token_id: token_id;
end;

// type balanceOfRequest = {
//     owner: tokenOwner,
//     token_id: tokenId,
// };

type balance_of_response is record
    request: balance_of_request;
    balance: token_balance;
end;

// type balanceOfResponse = {
//     request: balanceOfRequest,
//     balance: tokenBalance,
// };

type balance_of_callback is contract(list(balance_of_response));

// type balanceOfCallback = contract(list(balanceOfResponse));

type balance_of_parameter is record
    requests: list(balance_of_request);
    callback: balance_of_callback;
end;

// type balanceOfParameter = {
//     requests: list(balanceOfRequest),
//     callback: balanceOfCallback,
// };

type balance_of_request_michelson is michelson_pair_right_comb(balance_of_request);

// type balanceOfRequestMichelson = michelson_pair_right_comb(balanceOfRequest);

type balance_of_response_auxiliary is record [
    balance: token_balance;
    request: balance_of_request_michelson;
]

// type balanceOfResponseAuxiliary = {
//     request: balanceOfRequestMichelson,
//     balance: tokenBalance
// };

type balance_of_response_michelson is michelson_pair_right_comb(balance_of_response_auxiliary);

// type balanceOfResponseMichelson = michelson_pair_right_comb(balanceOfResponseAuxiliary);

type balance_of_callback_michelson is contract(list(balance_of_response_michelson));

// type balanceOfCallbackMichelson = contract(list(balanceOfResponseMichelson));

type balance_of_parameter_auxiliary is record [
    requests: list(balance_of_request_michelson);
    callback: balance_of_callback_michelson;
]

// type balanceOfParameterAuxiliary = {
//     requests: list(balanceOfRequestMichelson),
//     callback: balanceOfCallbackMichelson
// };

type balance_of_parameter_michelson is michelson_pair_right_comb(balance_of_parameter_auxiliary);

// type balanceOfParameterMichelson = michelson_pair_right_comb(balanceOfParameterAuxiliary);


// Update_operators types
type token_operator is address;
// type tokenOperator = address;

type operator_parameter is record [
    owner: token_owner;
    operator: token_operator;
]

// type operatorParameter = {
//     owner: tokenOwner,
//     operator: tokenOperator,
// }

type update_operators_add_or_remove is
// // There's an extra `_p` in the constructors below to avoid 'redundant constructor' error
// // due to the interop type conversions below
// Type constructors have to start with capital letters
| Add_operator_p of operator_parameter
| Remove_operator_p of operator_parameter

// type updateOperatorsAddOrRemove =
// // There's an extra `_p` in the constructors below to avoid 'redundant constructor' error
// // due to the interop type conversions below
// | Add_operator_p(operatorParameter)
// | Remove_operator_p(operatorParameter)

type operator_parameter_michelson is michelson_pair_right_comb(operator_parameter);

// type operatorParameterMichelson = michelson_pair_right_comb(operatorParameter);

type update_operators_add_or_remove_auxiliary is
| Add_operator of operator_parameter_michelson
| Remove_operator of operator_parameter_michelson

// type updateOperatorsAddOrRemoveAuxiliary =
// | Add_operator(operatorParameterMichelson)
// | Remove_operator(operatorParameterMichelson)

type update_operators_add_or_remove_michelson is michelson_or_right_comb(update_operators_add_or_remove_auxiliary);

// type updateOperatorsAddOrRemoveMichelson = michelson_or_right_comb(updateOperatorsAddOrRemoveAuxiliary);

type update_operators_parameter is list(update_operators_add_or_remove_michelson);

// type updateOperatorsParameter = list(updateOperatorsAddOrRemoveMichelson);

type action is
| Transfer of transfer_param
| Balance_of of balance_of_parameter_michelson
| Update_operators of update_operators_parameter

// operatorUpdatePolicy = Owner_update
function can_update_operators (var token_owner: token_owner; var storage : storage) : unit is
    begin
        if Tezos.sender =/= token_owner then failwith("Only owner can update operators") else skip;
    end with Unit

function update_operators (var storage: storage; var operator_parameter_michelson: operator_parameter_michelson; const add: bool): storage is
    begin
        var operator_parameter: operator_parameter := Layout.convert_from_right_comb(operator_parameter_michelson);
        const unit_value: unit = can_update_operators((operator_parameter.owner, storage));
        var account: account := record
                balance = 0n;
                allowances = (set []: set(address));
        end;
        case storage.ledger[operator_parameter.owner] of
            | Some(acc) -> account := acc
            | None -> skip
        end;
        var allowances: set(address) := account.allowances;
        if add then block {
            allowances := Set.add(operator_parameter.operator, allowances);
        };
        else block {
            allowances := Set.remove(operator_parameter.operator, allowances);
        };
        account.allowances := allowances;
        storage.ledger[operator_parameter.owner] := account;

    end with storage

function update_operators_iterator (var storage: storage; var update_operators_add_or_remove_michelson: update_operators_add_or_remove_michelson): storage is
    begin
        const update_operators_add_or_remove_auxiliary: update_operators_add_or_remove_auxiliary = Layout.convert_from_right_comb(update_operators_add_or_remove_michelson);
        const ret: storage = case update_operators_add_or_remove_auxiliary of
            | Add_operator(operator_parameter_michelson) -> update_operators(storage, operator_parameter_michelson, True )
            | Remove_operator(operator_parameter_michelson) -> update_operators(storage, operator_parameter_michelson, False )
        end
    end with ret

function update_operators (const update_operators_parameter: update_operators_parameter; var storage: storage) : (list(operation) * storage) is
begin
    storage := List.fold(update_operators_iterator, update_operators_parameter, storage);
end with ((nil: list(operation)), storage)

// Balance and transfer functionality
function account_balance_with_default_nat(const account_option: option(account); const default: nat) : nat is
    case account_option of
        | Some(value) -> value.balance
        | None -> default
    end

function get_with_default_nat(const option : option(nat); const default : nat) : nat is
    case option of
        | Some(value) -> value
        | None -> default
    end

// Return true iff Tezos.source (transcation originator) has been granted access to spend from spender
function is_allowed ( const spender : address ; const value : nat ; var s : storage) : bool is
  begin
    var allowed: bool := False;
    if Tezos.sender =/= Tezos.source then block {
      const src: account = case s.ledger[spender] of
        Some (acc) -> acc
        | None -> (failwith("NoAccount"): account)
      end;
      // TODO: This is clumsy, fix?
      case src.allowances contains Tezos.sender of
        True -> allowed := True
        | False -> allowed := False
      end;
    };
    else allowed := True;
  end with allowed

// Handle Balance_of requests
const default_token_balance: token_balance = 0n;
function get_token_balance (var token_id: token_id; var token_owner: token_owner; var storage: storage) : token_balance
 is begin
    if token_id =/= 0n then failwith("FA2_TOKEN_UNDEFINED") else skip; // This token contract only supports a single, fungible asset
    const ledger: ledger = storage.ledger;
    const token_lookup_id: token_lookup_id = token_owner; // If token should handle multiple assets, change to tuple (token_id, token_owner)
    const account: option(account) = Map.find_opt(token_lookup_id, ledger);
    const token_balance: token_balance = account_balance_with_default_nat(account, default_token_balance);
 end with token_balance

type balance_of_requests_iterator_accumulator is (list(balance_of_response_michelson) * storage);
function balance_of_requests_iterator (var acc: balance_of_requests_iterator_accumulator; var balance_of_request_michelson: balance_of_request_michelson) : balance_of_requests_iterator_accumulator
 is begin
    // TODO: This would be prettier with pattern matching (balance_of_responses, storage) = acc;
    const balance_of_responses: list(balance_of_response_michelson) = acc.0;
    const storage: storage = acc.1;
    const balance_of_request: balance_of_request = Layout.convert_from_right_comb(balance_of_request_michelson);
    const token_balance: token_balance = get_token_balance(balance_of_request.token_id, balance_of_request.owner, storage);
    const balance_of_response_auxiliary: balance_of_response_auxiliary = record [
        request = balance_of_request_michelson;
        balance = token_balance;
    ];
    const balance_of_response_michelson: balance_of_response_michelson = Layout.convert_to_right_comb((balance_of_response_auxiliary: balance_of_response_auxiliary));
    var ret: list(balance_of_response_michelson) := balance_of_response_michelson # balance_of_responses; // # is the cons operator
 end with(ret, storage)

function balance_of (const balance_of_parameter_michelson : balance_of_parameter_michelson; var storage : storage) : (list(operation) * storage)
 is block {
    const balance_of_parameter: balance_of_parameter_auxiliary = Layout.convert_from_right_comb(balance_of_parameter_michelson);
    var balance_of_responses := List.fold (balance_of_requests_iterator, balance_of_parameter.requests, ((nil: list(balance_of_response_michelson)), storage));
    const callback_operation: operation = Tezos.transaction(balance_of_responses.0, 0tez, balance_of_parameter.callback);
  } with (list [callback_operation], storage)

// TODO: This is very ineffective in terms of gas, big optimizations should be possible
function transfer (const transfer_param : transfer_param; var storage : storage) : (list(operation) * storage)
 is begin
    function transfer_iterator (const storage : storage; const transfer : transfer) : storage
        is begin
            (* Verify that transaction originator is allowed to spend from this address *)
            const allowed = is_allowed(transfer.from_, transfer.amount, storage);
            if allowed then skip;
            else failwith ("Sender not allowed to spend token from source");

            if transfer.token_id =/= 0n then failwith("FA2_TOKEN_UNDEFINED") else skip; // This token contract only supports a single, fungible asset

            const sender_balance: nat = get_token_balance(transfer.token_id, transfer.from_, storage);
            if sender_balance < transfer.amount then failwith("Insufficient balance") else skip;
            (* Update the ledger accordingly *)
            var sender_account: account := record
                balance = 0n;
                allowances = (set []: set(address));
            end;
            case storage.ledger[transfer.from_] of
                Some (account) -> sender_account := account
                | None -> failwith("No sender balance")
            end;
            sender_account.balance := abs(sender_account.balance - transfer.amount);
            storage.ledger[transfer.from_] := sender_account;
            var recipientAccount: account := record
                balance = 0n;
                allowances = (set []: set(address));
            end;
            case storage.ledger[transfer.to_] of
                Some (acc) -> recipientAccount := acc
                | None -> skip
            end;
            recipientAccount.balance := recipientAccount.balance + transfer.amount;
            storage.ledger[transfer.to_] := recipientAccount;
        end with storage;

    storage := list_fold(transfer_iterator, transfer_param, storage);
 end with ((nil : list(operation)), storage)

(* Default function that represents our contract, it's sole purpose here is the entrypoint routing *)
function main (const action : action; var storage : storage) : (list(operation) * storage)
    is (case action of
    (*
        Unwrap the `Transfer(...)` parameters and invoke the transfer function.
        The return value of `transfer(...)` is then returned as a result of `main(...)` as well.
     *)
    | Transfer(transfer_param) -> transfer(transfer_param, storage)
    | Balance_of(balance_of_parameter_michelson) -> balance_of(balance_of_parameter_michelson, storage)
    | Update_operators(update_operators_parameter) -> update_operators(update_operators_parameter, storage)

    (* This is just a placeholder *)
    // | U -> ((nil : list(operation)), storage)
    end)
