Compile contract:

```
$ ligo compile-contract --michelson-format=json contracts/main/fa1_2_kiss.ligo main | tr -d '\r' > out/fa1_2_kiss.tz
$ ligo compile-contract --michelson-format=json contracts/main/fa1_2_kiss_activity.ligo main | tr -d '\r' > out/fa1_2_kiss_activity.tz
```

Compile storage for balance contract:
```
$ ligo compile-storage --michelson-format=json contracts/main/fa1_2_kiss.ligo main 'record [ external_contract_address=("tz1QmL462eax1S2PvJC6TZdNg7TsxxfJSkzx": address); ledger=big_map[("tz1QmL462eax1S2PvJC6TZdNg7TsxxfJSkzx" : address)->record[balance=1000000000000n; allowances=(map[] : map(address, nat)); debit=0n; ]]; nonces=(big_map [] : big_map(address, nat)); total_supply=1000000000000n; allowed_activities=map[0n->True;1n->True;2n->True]; admin=("tz1QmL462eax1S2PvJC6TZdNg7TsxxfJSkzx" : address)  ]'
```

Notice that the `external_contract_address` value above is set to a wrong (temporary) value. It needs to point to the acitivty log contract deployed below. This can be fixed by precalculating the contract address or by calling the `change_activity_log` endpoint.

Compile storage for activity log contract:
```
$ ligo compile-storage --michelson-format=json contracts/main/fa1_2_kiss_activity.ligo main 'record [ activity_balance=(map [] : map(nat, nat)); allowed_activities=map[0n->True;1n->True;2n->True]; admin=("<address_of_balance_contract>" : address); ]'
```
