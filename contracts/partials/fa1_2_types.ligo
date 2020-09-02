type account is record
    balance : nat;
    allowances: map(address, nat);
end
