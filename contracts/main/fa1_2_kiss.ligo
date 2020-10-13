#include "../partials/fa1_2_types.ligo"

// KISS-specific data structures
type activity is nat;

type tandem_claim is record
    // helpees needs to be a list since signature are not comparable and set can only handle comparable types
    helpees: list((address * (key * signature)));
    helpers: set(address); // those who receive minutes
    activities: set(activity);
    minutes: nat;
end

type tandem_claim_michelson is michelson_pair_right_comb(tandem_claim);

type tandem_param is list(tandem_claim_michelson);

type action is
| Transfer of (address * address * nat)
| Approve of (address * nat)
| Get_allowance of (address * address * contract(nat))
| Get_balance of (address * contract(nat))
| Get_total_supply of (unit * contract(nat))
| Register_tandem_claims of tandem_param

type storage is record
  ledger: big_map(address, account);

  // nonces are used to prevent replay attacks where signatures can be reused
  nonces: big_map(address, nat);
  total_supply: nat;
end

// This is used by fa1_2_base, and it verifies the whitelisting status
function transfer_allowed(const from_ : address ; const to_ : address ; const storage : storage) : unit is Unit;

#include "../partials/fa1_2_base.ligo"

type signed_claim is record [
    signature: signature;
    pk: key;
    sender: address; // can be derived from pk
    minutes: nat;
    activities: set(nat);
    recipients: set(address);
    nonce: nat;
];
function register_tandem_claims(const claims: list(tandem_claim_michelson); var storage : storage): (list(operation) * storage) is
begin
    // Signatures are protected against replay attack such that each signature can only be used for one withdrawal
    // but they are *not* protected against recombination attacks where a helpee's signature is replaced with another
    // helpee's signature in the case that the same set of helpers (recipients) perform the same task to
    // to equally-sized groups of helpees.
    function verify_signature(const signed_claim: signed_claim) : bool is
    begin
        // We create a left-balanced tree to pack the relevant values: (((nonce, minutes), activities ), recipients)
        const nonce: nat = get_force(signed_claim.sender, storage.nonces);
        const message: bytes = Bytes.pack((((nonce, signed_claim.minutes), signed_claim.activities), signed_claim.recipients));
        const valid: bool = Crypto.check(signed_claim.pk, signed_claim.signature, message);
    end with valid;

    function register_tandem_claim_iterator(var storage : storage ; const claim: tandem_claim_michelson): storage is
    begin
        var tandem_claim: tandem_claim := Layout.convert_from_right_comb(claim);

        // How much should each helpee pay?
        // Note that we use Euclidean division here
        const minutes_per_helpee : nat = tandem_claim.minutes / List.size( tandem_claim.helpees );
        if minutes_per_helpee * List.size( tandem_claim.helpees ) =/= tandem_claim.minutes then
            failwith("TOTAL_MINUTES_NOT_DIVISIBLE_BY_HELPEES_LENGTH");
        else
            skip;

        function helpees_to_signed_claims(var signed_claims: list(signed_claim); const helpee: (address * (key * signature))): list(signed_claim) is
        begin
            var nonce: nat := 0n;
            case storage.nonces[helpee.0] of
                | Some (nonce_) -> nonce := nonce_
                | None -> skip
            end;
            const new_element: signed_claim = record[
                signature = helpee.1.1;
                pk = helpee.1.0;
                sender = helpee.0;
                recipients = tandem_claim.helpers;
                minutes = minutes_per_helpee;
                activities = tandem_claim.activities;
                nonce = nonce;
            ];
            signed_claims := new_element # signed_claims;
        end with signed_claims;

        function verify_signature_iterator(var validator: bool; const signed_claim: signed_claim): bool is
        begin
            const res: bool = verify_signature(signed_claim);
        end with res and validator;

        function apply_signed_claim(var storage: storage; const signed_claim: signed_claim): storage is
        begin
            const minutes_per_recipient: nat = signed_claim.minutes / Set.size( signed_claim.recipients );

            // TODO: Should we also check if signed_claim.minutes % List.size( signed_claim.helpers ) == 0 here?

            function transfer_to_recipient(var storage: storage; const recipient: address): storage is
            begin
                var dst: account := record
                    balance = 0n;
                    allowances = (map end : map(address, nat));
                end;
                case storage.ledger[recipient] of
                    | None -> skip
                    | Some(n) -> dst := n
                end;

                // Update the recipient balance
                dst.balance := dst.balance + minutes_per_recipient;
                storage.ledger[recipient] := dst;
            end with storage;

            // Fetch src account, a source account will not exist in storage
            // if accountFrom has never received an amount, nor approved any
            // address to spend from it
            var src: account := record
                balance = 0n;
                allowances = (map end : map(address, nat));
            end;
            case storage.ledger[signed_claim.sender] of
                | Some (acc) -> src := acc
                | None -> skip
            end;

            // Check that the source can spend that much
            if signed_claim.minutes > src.balance then
                failwith ("NotEnoughBalance");
            else
                skip;

            // Update nonce of sender to prevent replay attack
            storage.nonces[signed_claim.sender] := signed_claim.nonce + 1n;

            // Update the source balance
            // This must be done before minutes are subtracted from spenders since
            // sending to self would otherwise be a way to increase total supply!
            src.balance := abs(src.balance - signed_claim.minutes);
            storage.ledger[signed_claim.sender] := src;

            // Transfer owed balance to each recipient
            storage := Set.fold(transfer_to_recipient, signed_claim.recipients, storage)
        end with storage;

        var signed_claims: list(signed_claim) := List.fold(helpees_to_signed_claims, tandem_claim.helpees, (nil: list(signed_claim)));

        // TODO: add logic to handle transactions here
        // Verify all signatures
        const valid_signatures: bool = List.fold(verify_signature_iterator, signed_claims, True);
        if not valid_signatures then
            failwith("INVALID_SIGNATURE")
        else
            skip;

        // Make all balance updates
        storage := List.fold(apply_signed_claim, signed_claims, storage);

        // For each helper in the helpers set, create an individual_tandem_claim record and iterate over these.
    end with storage;

    // Iterate over all claims
    storage := List.fold(register_tandem_claim_iterator, claims, storage);
end with ((nil: list(operation)), storage);

function main (const p : action ; const s : storage) :
  (list(operation) * storage) is
 block {
   // Reject any transaction that tries to transfer token to this contract
   if amount =/= 0tz then failwith ("This contract does not accept tezi deposits");
   else skip;
  } with case p of
  | Transfer(n) -> ((nil : list(operation)), transfer(n.0, n.1, n.2, s))
  | Approve(n) -> ((nil : list(operation)), approve(n.0, n.1, s))
  | Get_allowance(n) -> (get_allowance(n.0, n.1, n.2, s), s)
  | Get_balance(n) -> (get_balance(n.0, n.1, s), s)
  | Get_total_supply(n) -> (get_total_supply(n.1, s), s)
  | Register_tandem_claims(n) -> (register_tandem_claims(n, s))
  end
