import { action, observable } from 'mobx';

export const STEPS = {
  'fee': Symbol('fee'),
  'certify': Symbol('certify')
};

class AppStore {
  @observable step = STEPS[Object.keys(STEPS)[1]];

  @action
  goto (name) {
    if (!STEPS[name]) {
      return;
    }

    this.step = STEPS[name];
  }
}

export default new AppStore();
