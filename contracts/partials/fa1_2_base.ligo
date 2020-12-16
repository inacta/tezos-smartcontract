function is_approved ( const spender : address ; const value : nat ; var s : storage) : bool is
  begin
    var allowed: bool := False;
    if Tezos.sender =/= spender then block {
      const src: account = case s.ledger[spender] of
        Some (acc) -> acc
        | None -> (failwith("NotEnoughAllowance"): account)
      end;
      const allowanceAmount: nat = case src.allowances[Tezos.sender] of
        Some (allowance) -> allowance
        | None -> (failwith("NotEnoughAllowance"): nat)
      end;
      allowed := allowanceAmount >= value;
    };
    else allowed := True;
  end with allowed


// Transfer a specific amount of tokens from the accountFrom address to a destination address
// Pre conditions:
//  The sender address is the account owner or is allowed to spend x in the name of accountFrom
//  The accountFrom account has a balance higher than amount
// Post conditions:
//  The balance of accountFrom is decreased by amount
//  The balance of destination is increased by amount
function transfer (const accountFrom : address ; const destination : address ; const value : nat ; var s : storage) : storage is
 begin
  if accountFrom = destination then skip;
  else block {
    // Verify that caller address (Sender) is allowed to spend from this address
    const allowed = is_approved(accountFrom, value, s);
    if allowed then skip;
    else failwith ("NotEnoughAllowance");

    const unit_value: unit = transfer_allowed(accountFrom, destination, s);

    // Fetch src account, a source account will not exist in storage
    // if accountFrom has never received an amount, nor approved any
    // address to spend from it
    var src: account := record
        balance = 0n;
        allowances = (map end : map(address, nat));
    end;
    case s.ledger[accountFrom] of
      | Some (acc) -> src := acc
      | None -> skip
    end;

    // Check that the source can spend that much
    if value > src.balance
    then failwith ("NotEnoughBalance");
    else skip;

    // Update the source balance
    // Using the abs function to convert int to nat
    src.balance := abs(src.balance - value);

    // Decrease the allowance amount if necessary
    if accountFrom =/= sender then block {
        const allowanceAmount: nat = case src.allowances[Tezos.sender] of
          Some (allowance) -> allowance
          | None -> (failwith("NotEnoughAllowance"): nat)
        end;
        if allowanceAmount - value < 0 then failwith ("NotEnoughAllowance");
        else src.allowances[Tezos.sender] := abs(allowanceAmount - value);
    } else skip;

    s.ledger[accountFrom] := src;

    // Fetch dst account or add empty dst account to ledger
    var dst: account := record
        balance = 0n;
        allowances = (map end : map(address, nat));
    end;
    case s.ledger[destination] of
      | None -> skip
      | Some(n) -> dst := n
    end;

    // Update the destination balance
    dst.balance := dst.balance + value;

    s.ledger[destination] := dst;
  }
 end with s

// Approve an amount to be spent by another address in the name of the sender
// Pre conditions:
//  The spender account is not the sender account
// Post conditions:
//  The allowance of spender in the name of sender is value
function approve (const spender : address ; const value : nat ; var s : storage) : storage is
 begin
  // If sender is the spender approving is not necessary
  if Tezos.sender = spender then skip;
  else block {
      var account := record
        balance = 0n;
        allowances = (map end : map(address, nat));
      end;
      case s.ledger[Tezos.sender] of
          Some (acc) -> account := acc
          | None -> skip
      end;

      // Verify that this change is not unsafe, as specified in the interface definition
      case account.allowances[spender] of
        Some (current_value) -> block {
            if current_value > 0n and value > 0n then failwith("UnsafeAllowanceChange") else skip;
        }
        | None -> skip
      end;

      // Update state
      account.allowances[spender] := value;
      s.ledger[Tezos.sender] := account; // Not sure if this last step is necessary
  }
 end with s

// Note that the following three view functions are intended for contract-2-contract interaction,
// they are not like Ethereum's view functions which can run without writing to the blockchain.
// If you want to read a balance or another value from a deployed contract, you should read
// directly from memory.

// View function that forwards the allowance amount of spender in the name of tokenOwner to a contract
// Pre conditions:
//  None
// Post conditions:
//  The state is unchanged
function get_allowance (const owner : address ; const spender : address ; const contr : contract(nat) ; var s : storage) : list(operation) is
begin
    const destAllowance: nat =
    case s.ledger[owner] of
        | None -> 0n
        | Some (acc) ->
        case acc.allowances[spender] of
            | None -> 0n
            | Some (allowance) -> allowance
        end
    end;
end with list [transaction(destAllowance, 0tz, contr)]

// View function that forwards the balance of source to a contract
// Pre conditions:
//  None
// Post conditions:
//  The state is unchanged
function get_balance (const src : address ; const contr : contract(nat) ; var s : storage) : list(operation) is
begin
    const balance_: nat = case s.ledger[src] of
        | Some (acc) -> acc.balance
        | None -> 0n
  end;
end with list [transaction(balance_, 0tz, contr)]

// View function that forwards the totalSupply to a contract
// Pre conditions:
//  None
// Post conditions:
//  The state is unchanged
function get_total_supply (const contr : contract(nat) ; var s : storage) : list(operation) is
  list [transaction(s.total_supply, 0tz, contr)]
