module.exports = {
  http: {
    hostname: '127.0.0.1',
    port: 4000
  },
  nodeWs: 'ws://127.0.0.1:8546/',
  certifierContract: '0x06C4AF12D9E3501C173b5D1B9dd9cF6DCC095b98',
  feeContract: '0xD5d12e7c067Aecb420C94b47d9CaA27912613378',
  saleContract: '0x1812C24112a96487435cb77e8fab92E2eAb212ea',
  redis: {
    host: '127.0.0.1',
    port: 6379
  },
  // Gas Price of 2GWei
  gasPrice: '0x77359400'
};
