# @sozu/connect

```bash
npm install @sozu/connect
```

`login()` and `pay()` open a popup on `https://dev.sozu.capital`. The user approves with their passkey. You receive a username and a Stellar smart account (`C…`). `pay()` sends Circle testnet USDC that account already holds. You never receive a key.

```ts
import { login, pay } from "@sozu/connect"

const { username, accountId } = await login()

const paid = await pay({
  amount: "5",
  to: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
})

if ("error" in paid) {
  // { username, accountId, error: "insufficient_funds" }
} else {
  paid.txHash
}
```

`amount` is a positive decimal string with at most 7 decimal places. `to` is a Stellar `G…` or `C…` address. A username is rejected before the popup opens. Closing the popup or a failed signup rejects the promise. A short Circle balance resolves `insufficient_funds` and does not ask the user to confirm a payment.

## Fund the account

The `C` account receives Circle testnet USDC through the Circle SAC contract. A classic payment to a `G` address does not fund it. This package does not submit the inbound transfer. Send it with your own key:

```ts
import {
  Address,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk"

const CIRCLE_TESTNET_USDC_SAC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
const source = Keypair.fromSecret(process.env.DEVELOPER_SECRET!)
const server = new rpc.Server("https://soroban-testnet.stellar.org")
const account = await server.getAccount(source.publicKey())

const tx = new TransactionBuilder(account, {
  fee: "1000000",
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    new Contract(CIRCLE_TESTNET_USDC_SAC).call(
      "transfer",
      Address.fromString(source.publicKey()).toScVal(),
      Address.fromString(accountId).toScVal(),
      nativeToScVal(BigInt(5_0000000), { type: "i128" }),
    ),
  )
  .setTimeout(30)
  .build()

const prepared = await server.prepareTransaction(tx)
prepared.sign(source)
await server.sendTransaction(prepared)
```

`5_0000000` is 5 USDC at 7 decimal places. `accountId` is the `C` address returned by `login()`.
