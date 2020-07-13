# Tezos starter kit
<img src="https://stove-labs.com/logo_transparent.png" width="100px"/>

## What is the tezos-starter-kit?

The Tezos starter kit provides a *truffle box* with reasonable defaults to kick start your smart contract development experience. It includes a ready to use archive sandbox node with RPC & CORS configured.

## Dependencies

- **Docker** - used to run a local Tezos node together with the LIGO compiler (If you're on linux, follow the post-installation steps as well)
- **Node.js** - Javascript runtime environment that we'll use for testing and deployment
- **LIGO** - High level programming language for the Tezos blockchain
- **truffle@tezos** - Testing framework, originally built for Ethereum that now includes support for Tezos.

## Getting started

**Unbox the starter kit & install the dependencies**
```shell
$ git clone https://github.com/stove-labs/tezos-starter-kit
$ cd tezos-starter-kit
$ yarn install
```

**Compile the example contract**
```shell
$ yarn compile
```

**Start the local sandbox node**
```shell
$ yarn sandbox:start -- carthage
```

**Migrate the compiled contracts**
```shell
$ yarn migrate
```

**Run the contract tests**
```shell
$ yarn test
```

**Watch project files and recompile/remigrate/retest**
```shell
$ yarn compile:watch
$ yarn migrate:watch
$ yarn test:watch
```

## Sandbox management

Archive mode sandbox Tezos node is provided within this box with RPC exposed at port `8732` and with two accounts that are generously funded.

> You can start a sandbox with a specific protocol by passing an additional argument to the sandbox commands, e.g. `babylon` or `carthage`

#### Commands

```shell
$ yarn sandbox:start -- carthage
$ yarn sandbox:kill -- carthage
$ yarn sandbox:restart -- carthage
```

#### Available accounts
|alias  |pkh  |pk  |sk   |
|---|---|---|---|
|alice   |tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb   |edpkvGfYw3LyB1UcCahKQk4rF2tvbMUk8GFiTuMjL75uGXrpvKXhjn   |edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq   |
|bob   |tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6   |edpkurPsQ8eUApnLUJ9ZPDvu98E8VNj4KtJa1aZr16Cr5ow5VHKnz4   |edsk3RFfvaFaxbHx8BMtEW1rKQcPtDML3LXjNqMNLCzC3wLC1bWbAt   |

## Usage with public testnets (Babylonnet, Carthagenet, ...)

In order to use your migration scripts with a different network than your local sandbox, you can specify an optional `--network` argument.

Make sure to [claim a new account at the faucet](https://faucet.tzalpha.net), and replace the `faucet.json` file with the new one downloaded previously.
```shell
$ yarn migrate -- --network carthagenet
```
