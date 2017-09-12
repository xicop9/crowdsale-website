import BigNumber from 'bignumber.js';
import EthereumTx from 'ethereumjs-tx';
import { action, computed, observable } from 'mobx';
import { phraseToWallet } from '@parity/ethkey.js';
import { randomPhrase } from '@parity/wordlist';
import store from 'store';

import backend from '../backend';
import appStore from './app.store';
import blockStore from './block.store';
import { isValidAddress } from '../utils';

const FEE_REGISTRAR_ADDRESS = '0xa18376621ed621e22de44679f715bfdd15c9b6f9';
// Gas Limit of 100k gas
const FEE_REGISTRAR_GAS_LIMIT = new BigNumber('0x186a0');
// Gas Price of 5Gwei
const FEE_REGISTRAR_GAS_PRICE = new BigNumber('0x12a05f200');
// Signature of `pay(address)`
const FEE_REGISTRAR_PAY_SIGNATURE = '0x0c11dedd';

const FEE_HOLDER_LS_KEY = '_parity-certifier::fee-holder';
const PAYER_LS_KEY = '_parity-certifier::payer';

export const STEPS = {
  'waiting-payment': Symbol('waiting for payment'),
  'account-selection': Symbol('account selection'),
  'from-exchange': Symbol('from an exchange'),
  'from-personal': Symbol('from a personal wallet'),
  'sending-payment': Symbol('sending payment'),
  'already-paid': Symbol('already paid')
};

class FeeStore {
  @observable fee = null;
  @observable step = STEPS['waiting-payment'];

  // The address of the actual fee-payer
  @observable payer = '';
  @observable incomingChoices = [];

  // The throw-away wallet created on load that will
  // receive the fee
  @observable wallet = null;

  constructor () {
    this.load();
  }

  async load () {
    appStore.setLoading(true);

    const storedPayer = store.get(PAYER_LS_KEY);

    try {
      // A Payer has been stored in localStorage
      if (storedPayer) {
        const { paid } = await backend.getAccountFeeInfo(storedPayer);

        // Go to the certification if (s)he paid
        if (paid) {
          this.setPayer(storedPayer);
          appStore.setLoading(false);
          return appStore.goto('certify');
        }

        // Otherwise, remove it from LS and continue
        store.remove(PAYER_LS_KEY);
      }

      // Retrieve the fee
      const fee = await backend.fee();
      // Get the throw-away wallet
      const wallet = await this.getWallet();

      this.setFee(fee);
      this.setWallet(wallet);

      await this.checkWallet();
    } catch (error) {
      console.error(error);
    }

    appStore.setLoading(false);
  }

  async checkPayer () {
    const { payer } = this;
    const { paid } = await backend.getAccountFeeInfo(payer);

    if (paid) {
      store.set(PAYER_LS_KEY, payer);
      appStore.goto('certify');

      return true;
    }

    return false;
  }

  async checkWallet () {
    const { address } = this.wallet;
    const { balance, incomingTxAddr } = await backend.getAccountFeeInfo(address);

    if (balance.gte(this.totalFee)) {
      this.goto('account-selection');
    }

    this.setBalance(balance, incomingTxAddr);
  }

  async getWallet () {
    const storedPhrase = store.get(FEE_HOLDER_LS_KEY);
    const phrase = storedPhrase || randomPhrase(12);

    if (!storedPhrase) {
      store.set(FEE_HOLDER_LS_KEY, phrase);
    }

    const { address, secret } = await phraseToWallet(phrase);

    return { address, secret, phrase };
  }

  @action goto (step) {
    if (!STEPS[step]) {
      throw new Error(`unkown step ${step}`);
    }

    this.step = STEPS[step];
  }

  async sendPayment () {
    const { payer } = this;

    if (!isValidAddress(payer)) {
      throw new Error('invalid payer address: ' + payer);
    }

    console.warn('sending tx for', payer);
    this.goto('sending-payment');

    try {
      const { address, secret } = this.wallet;
      const privateKey = Buffer.from(secret.slice(2), 'hex');

      const nonce = await backend.nonce(address);
      const calldata = FEE_REGISTRAR_PAY_SIGNATURE + payer.slice(-40).padStart(64, 0);

      const tx = new EthereumTx({
        to: FEE_REGISTRAR_ADDRESS,
        gasLimit: '0x' + FEE_REGISTRAR_GAS_LIMIT.toString(16),
        gasPrice: '0x' + FEE_REGISTRAR_GAS_PRICE.toString(16),
        data: calldata,
        value: '0x' + this.fee.toString(16),
        nonce
      });

      tx.sign(privateKey);

      const serializedTx = `0x${tx.serialize().toString('hex')}`;
      const { hash } = await backend.sendFeeTx(serializedTx);

      console.warn('sent tx', hash);

      this.watchPayer();
    } catch (error) {
      console.error(error);
    }
  }

  @computed get requiredEth () {
    const { fee, wallet } = this;

    if (fee === null || wallet === null || !wallet.balance) {
      return null;
    }

    const value = this.totalFee;

    if (value.lte(wallet.balance)) {
      return new BigNumber(0);
    }

    return value.sub(wallet.balance);
  }

  @computed get totalFee () {
    const { fee } = this;

    if (fee === null) {
      return null;
    }

    return fee.plus(FEE_REGISTRAR_GAS_PRICE.mul(FEE_REGISTRAR_GAS_LIMIT));
  }

  @action setBalance (balance, incomingChoices) {
    this.incomingChoices = incomingChoices;
    this.wallet = Object.assign({}, this.wallet, { balance });
  }

  @action setFee (fee) {
    this.fee = fee;
  }

  @action setPayer (payer) {
    this.payer = payer;
  }

  @action setWallet ({ address, secret, phrase }) {
    this.wallet = { address, secret, phrase };
  }

  watchPayer () {
    this.unwatchPayer();
    blockStore.on('block', this.checkPayer, this);
  }

  watchWallet () {
    this.unwatchWallet();
    blockStore.on('block', this.checkWallet, this);
  }

  unwatchPayer () {
    blockStore.removeListener('block', this.checkPayer, this);
  }

  unwatchWallet () {
    blockStore.removeListener('block', this.checkWallet, this);
  }
}

export default new FeeStore();