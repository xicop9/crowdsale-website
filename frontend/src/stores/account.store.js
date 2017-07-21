import Util from 'ethereumjs-util';
import Wallet from 'ethereumjs-wallet';
import { action, observable } from 'mobx';

import backend from '../backend';

const BALANCES_REFRESH_TIMER = 2500;

class AccountStore {
  @observable address = '';
  @observable balances = {};
  @observable error = null;
  @observable unlocked = false;
  @observable publicKey = null;
  @observable privateKey = null;
  @observable wallet = null;

  load (file) {
    this.setError(null);

    return this.read(file)
      .then((wallet) => {
        this.setAccountInfo({ address: wallet.address });
        this.setWallet(wallet);
      })
      .catch((error) => {
        this.setError(error.message);
      });
  }

  pollBalances () {
    this.updateBalances();

    setInterval(() => {
      this.updateBalances();
    }, BALANCES_REFRESH_TIMER);
  }

  read (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.readAsText(file);

      reader.addEventListener('error', () => {
        return reject(new Error('Unable to read the file.'));
      });

      reader.addEventListener('load', (event) => {
        try {
          const keyObject = JSON.parse(event.target.result);

          return resolve(keyObject);
        } catch (error) {
          return reject(new Error('Invalid JSON file.'));
        }
      });
    });
  }

  @action
  setAccountInfo ({ address, publicKey, privateKey }) {
    const cleanAddress = Util.toChecksumAddress('0x' + address.replace(/^0x/, ''));

    this.address = cleanAddress;
    this.publicKey = publicKey;
    this.privateKey = privateKey;
  }

  @action
  setBalances (balances) {
    this.balances = balances;
  }

  @action
  setError (error) {
    this.error = error;
  }

  @action
  setUnlocked (unlocked) {
    this.unlocked = unlocked;

    if (unlocked) {
      this.pollBalances();
    }
  }

  @action
  setWallet (wallet) {
    this.wallet = wallet;
    console.warn('wallet', wallet);
  }

  unlock (password) {
    this.setError(null);

    return new Promise((resolve) => {
      // Defer to allow the UI to render before blocking
      setTimeout(() => {
        let wallet;

        try {
          wallet = Wallet.fromV3(this.wallet, password);
        } catch (_) {
          this.setError('Invalid password');
          return resolve();
        }

        const address = '0x' + wallet.getAddress().toString('hex');
        const publicKey = wallet.getPublicKey();
        const privateKey = wallet.getPrivateKey();

        this.setAccountInfo({
          address,
          publicKey,
          privateKey
        });

        this.setUnlocked(true);
        return resolve();
      }, 0);
    });
  }

  async updateBalances () {
    const { eth, dot } = await backend.getBalances(this.address);

    this.setBalances({ eth, dot });
  }
}

export default new AccountStore();