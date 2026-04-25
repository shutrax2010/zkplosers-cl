Here's how to generate a wallet address on the Midnight testnet:

1. Generate or Restore a Seed
First, create a random seed or restore from an existing one:

```wallet-seed.ts
import { HDWallet, generateRandomSeed, Roles } from '@midnight-ntwrk/wallet-sdk-hd';

// Generate a new random seed
const seed = Buffer.from(generateRandomSeed()).toString('hex');
```

2. Derive Keys from the Seed
Use the HD wallet to derive role-specific keys:

```dust-generator index.ts
const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));

if (hdWallet.type !== 'seedOk') {
  throw new Error('Failed to initialize HDWallet from seed.');
}

const derivationResult = hdWallet.hdWallet
  .selectAccount(0)
  .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
  .deriveKeysAt(0);

if (derivationResult.type !== 'keysDerived') {
  throw new Error('Failed to derive keys from seed.');
}

hdWallet.hdWallet.clear(); // Clear sensitive key material
```

3. Generate the Unshielded (Testnet) Address
For a transparent/unshielded address on testnet, use the NightExternal key:

```wallet.ts; KeyStore.ts
import { createKeystore } from '@midnight-ntwrk/wallet-sdk';
import { UnshieldedAddress, MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';

const networkId = 'testnet'; // or 'preview', 'preprod', etc.
const unshieldedKeystore = createKeystore(derivationResult.keys[Roles.NightExternal], networkId);

// Get the Bech32m-encoded address string, e.g. mn_addr_test1...
const address = unshieldedKeystore.getBech32Address().asString();
console.log('Unshielded address:', address);
```

4. (Optional) Generate Shielded and Dust Addresses
```addresses.no-net.ts
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { ShieldedAddress, ShieldedCoinPublicKey, ShieldedEncryptionPublicKey, DustAddress } from '@midnight-ntwrk/wallet-sdk-address-format';

// Shielded address
const shieldedKeys = ledger.ZswapSecretKeys.fromSeed(derivationResult.keys[Roles.Zswap]);
const shieldedAddress = new ShieldedAddress(
  new ShieldedCoinPublicKey(Buffer.from(shieldedKeys.coinPublicKey, 'hex')),
  new ShieldedEncryptionPublicKey(Buffer.from(shieldedKeys.encryptionPublicKey, 'hex')),
);
const shieldedBech32 = MidnightBech32m.encode(networkId, shieldedAddress).toString();

// Dust address
const dustSecretKey = ledger.DustSecretKey.fromSeed(derivationResult.keys[Roles.Dust]);
const dustAddress = new DustAddress(dustSecretKey.publicKey);
const dustBech32 = MidnightBech32m.encode(networkId, dustAddress).toString();
```

Address format on testnet: Midnight uses Bech32m encoding. Testnet unshielded addresses look like mn_addr_test1..., shielded addresses like mn_shield-addr_test1..., and dust addresses like mn_dust_test1.... [Wallet Specification]