import React, {Component} from 'react';
import { Route, Redirect, withRouter } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import PageHeader from './components/PageHeader/PageHeader';
import Menu from './components/MainMenu/Menu';
import Login from './components/auth/Login';
import Logout from './components/auth/Logout';
import HomePage from './containers/Home/HomePage';
import ChartingPage from './containers/Charting/ChartingPage';
import SearchPage from './containers/Search/SearchPage';
import arweave from './arweave-config';
import './App.css';
import 'react-toastify/dist/ReactToastify.css';

class App extends Component {
  state = {
    isAuthenticated: null,
    contentToggled: false,
    contentStyle: {marginLeft: '0px'},
    balance: 0,
    wallet_address: null
  }

  constructor(props) {
    super(props);

    this.toggleContent.bind(this);
    this.explandContentArea.bind(this);
    this.addErrorAlert.bind(this);
    this.addSuccessAlert.bind(this);
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
      sessionStorage.removeItem('exchange');
      sessionStorage.removeItem('coinpair');

      this.setState({isAuthenticated: false, wallet_address: null, jwk: null, balance: 0});

      this.addSuccessAlert("Your wallet is now disconnected");
  }

  render() {
    let header = (
      <div>
      <aside id="aside">
        <Menu {...this.props}/>
      </aside>
      <header id="header">
        <PageHeader 
          isAuthenticated={this.state.isAuthenticated} 
          history={this.props.history} 
          current_balance={this.state.balance}
          wallet_address={this.state.wallet_address}
          onToggleContenArea={this.toggleContent.bind(this)}
          />
      </header>
      </div>
    );

    let routes = [
      <Route key='home' path="/" exact component={() => <HomePage wallet_address={this.state.wallet_address} jwk={this.state.jwk} />} />,
      <Route key='charts' path="/charts" exact component={() => <ChartingPage 
                                                                    addErrorAlert={this.addErrorAlert} 
                                                                    addSuccessAlert={this.addSuccessAlert} 
                                                                    wallet_address={this.state.wallet_address} 
                                                                    {...this.props}
                                                                    jwk={this.state.jwk} />} />,
      <Route key='search' path="/search" exact component={() => <SearchPage wallet_address={this.state.wallet_address} jwk={this.state.jwk} />} />,
      <Route key='logout' path="/logout" exact component={() => <Logout onLogout={this.disconnectWallet.bind(this)} addSuccessAlert={this.addSuccessAlert} explandContentArea={() => this.explandContentArea} />} />
    ];

    if(!this.state.isAuthenticated) {
      routes = [
        <Route key='login' path="/login" exact component={() => <Login explandContentArea={() => this.explandContentArea} setWalletAddress={this.setWalletAddress.bind(this)} />} />,
      ];
      if(this.props.location !== '/login') routes.push(<Redirect key='redirect-to-login' to='/login' />);
      header = null;
    }

    if(this.state.isAuthenticated && this.props.location.pathname === '/login') {
      routes = (
        <>
        <Redirect to='/' />
        </>
      );
    }

    return (
      
      <div id="wrapper" className="clearfix">
        <ToastContainer />
        {header}
        <section id="middle" style={this.state.contentStyle}>
        {routes}
        </section>
      </div>
    );
  }
  
}

export default withRouter(App);
