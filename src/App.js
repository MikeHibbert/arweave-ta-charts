import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';

import './sass/main.css';
import { Grid, Row, Col, MainContainer } from '@sketchpixy/rubix';
import { ToastContainer, toast } from 'react-toastify';
import Sidebar from './components/Sidebar/SideBar';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';

class App extends Component {
  state = {
    isAuthenticated: null,
    contentToggled: false,
    contentStyle: null,
    balance: 0,
    wallet_address: null
  }

  constructor(props) {
    super(props);

    this.toggleContent.bind(this);
    this.explandContentArea.bind(this);
  }

  toggleContent() {
    if(this.state.contentToggled) {
      this.setState({contentToggled: false, contentStyle: null});
    } else {
      this.setState({contentToggled: true, contentStyle: {marginLeft: '0px'}});
    }
  }

  explandContentArea() {
    this.setState({contentToggled: true, contentStyle: {marginLeft: '0px'}});
  }

  componentDidMount() {
    const wallet_address = sessionStorage.getItem('AR_Wallet', null);
    const jwk = JSON.parse(sessionStorage.getItem('AR_jwk', null));  
    
    if(jwk !== null) {
      this.setState({isAuthenticated: true, wallet_address: wallet_address, jwk: jwk});
      this.loadWallet(wallet_address);
    }

    const isAuthenticated = sessionStorage.getItem('isAuthenticated');

    this.setState({isAuthenticated: isAuthenticated === 'true' ? true : false});
  }

  componentDidUpdate(prevProps) {
    if(this.props.isAuthenticated !== undefined && this.props.isAuthenticated !== prevProps.isAuthenticated) {
      this.setState({isAuthenticated: this.props.isAuthenticated});

      if(this.props.isAuthenticated && !this.props.expand_content_area) {
        this.setState({contentStyle: {marginLeft: '0px'}});
      }
    }
  }

  loadWallet(wallet_address) {
    const that = this;

    if(wallet_address) {
        arweave.wallets.getBalance(wallet_address).then((balance) => {
            let ar = arweave.ar.winstonToAr(balance);

            const state = {balance: ar};

            that.setState(state);
        });   
    }     
  }
  
  addSuccessAlert(message)  {
    toast(message, { type: toast.TYPE.SUCCESS });     
  }

  addErrorAlert(message) {
    toast(message, { type: toast.TYPE.ERROR });  
  }

  disconnectWallet() {
    sessionStorage.removeItem('AR_Wallet');
    sessionStorage.removeItem('AR_jwk');
    sessionStorage.removeItem('isAuthenticated');
    this.setState({isAuthenticated: false, wallet_address: null, jwk: null, balance: 0});

    this.addSuccessAlert("Your wallet is now disconnected");
  } 

  setWalletAddress(wallet_address_files) {
    const that = this;

    const reader = new FileReader();
    reader.onload = function() {
        const text = reader.result;
        const jwk = JSON.parse(text);

        arweave.wallets.jwkToAddress(jwk).then((wallet_address) => {                
            that.setState({wallet_address: wallet_address, jwk: jwk});
            sessionStorage.setItem('AR_Wallet', wallet_address);
            sessionStorage.setItem('AR_jwk', JSON.stringify(jwk));
        
            that.loadWallet(wallet_address);

            that.setState({isAuthenticated: true});
            sessionStorage.setItem('isAuthenticated', true);

            that.addSuccessAlert("You have successfully connected.");
        });
        
    }
    reader.readAsText(wallet_address_files[0]);

  }

  render() {
    let routes = [

    ];
    return (
      <MainContainer {...this.props}>
          <Sidebar />
          <Header />
          <div id='body'>
            <ToastContainer />
            <Grid>
              <Row>
                <Col xs={12}>
                  {routes}
                </Col>
              </Row>
            </Grid>
          </div>
          <Footer />
        </MainContainer>
    );
  }
}

export default App;
