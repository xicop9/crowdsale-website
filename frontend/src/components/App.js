import React, { Component } from 'react';
import { Container, Header } from 'semantic-ui-react';

import Auction from './Auction';
import Sale from './Sale';

const style = {
  marginBottom: '2em',
  padding: '1em 0'
};

export default class App extends Component {
  render () {
    return (
      <div>
        <Container style={style}>
          <Header
            as='h3'
            textAlign='center'
          >
            AUCTION
          </Header>
          <br />
          <Auction.Info />
          <Sale />
        </Container>
        <Auction.Details />
      </div>
    );
  }
}
