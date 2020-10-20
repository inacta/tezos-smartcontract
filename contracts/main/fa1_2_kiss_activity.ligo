// Acticity balance are a mapping from an id (nat) to a balance (nat)

type storage is record
    activity_balance: map(nat, nat);
    allowed_activities: map(nat, bool);
    admin: address;
end;

type action is
| Update_activity_balance of (list(list((nat * nat))))
| Add_allowed_activity of nat
| Suspend_allowed_activity of nat
| Change_admin of address

function add_allowed_activity(const new_activity: nat; var storage: storage) : (list(operation) * storage) is
begin
    // If activity already exists, ignore and do not report error
    storage.allowed_activities[new_activity] := True;

end with ((nil: list(operation)), storage);

function suspend_allowed_activity(const activity: nat; var storage: storage) : (list(operation) * storage) is
begin
    case storage.allowed_activities[activity] of
        | Some(allowed) -> storage.allowed_activities[activity] := False
        | None -> failwith("ACTIVITY_DOES_NO_EXIST")
    end;
end with ((nil: list(operation)), storage);

function update_activity_balance(const activities_and_duration: list(list((nat * nat))); var storage: storage): (list(operation) * storage) is
begin
    function update_activity_balance_iterator_inner(var storage: storage ; const activity_and_duration: (nat * nat)): storage is
    begin
        case storage.allowed_activities[activity_and_duration.0] of
            | None -> failwith("ACTIVITY_DOES_NOT_EXIST")
            | Some(val) -> case val of
                | False -> failwith("ACTIVITY_SUSPENDED")
                | True -> skip
            end
        end;

        var balance_ : nat := activity_and_duration.1;
        case storage.activity_balance[activity_and_duration.0] of
            | Some(duration) -> storage.activity_balance[activity_and_duration.0] := duration + activity_and_duration.1
            | None -> storage.activity_balance[activity_and_duration.0] := activity_and_duration.1
        end;
    end with storage;

    function update_activity_balance_iterator_outer(var storage: storage ; const activities: list(nat * nat)) : storage is
    begin
        storage := List.fold(update_activity_balance_iterator_inner, activities, storage);
    end with storage;

    storage := List.fold(update_activity_balance_iterator_outer, activities_and_duration, storage);
end with ((nil: list(operation)), storage);

function change_admin(const new_admin: address; var storage: storage) : (list(operation) * storage) is
begin
    storage.admin := new_admin;
end with ((nil: list(operation)), storage);

function main (const p : action ; const s : storage) :
  (list(operation) * storage) is
 block {
   // Reject any transaction that tries to transfer token to this contract
   if amount =/= 0tz then failwith ("This contract does not accept tezi deposits");
   else skip;
   if Tezos.sender =/= s.admin then failwith ("CALLER_NOT_ADMIN");
   else skip;
  } with case p of
  | Add_allowed_activity(n) -> add_allowed_activity(n, s)
  | Update_activity_balance(n) -> update_activity_balance(n, s)
  | Suspend_allowed_activity(n) -> suspend_allowed_activity(n, s)
  | Change_admin(n) -> change_admin(n, s)
  end
