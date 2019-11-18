import React, { Component } from 'react';
import TradingViewChart from '../../components/Tradingview/Chart';
import * as ccxt from 'ccxt';
import backendHost from '../../backend_host';
import checkPendingTransactions from '../../helpers';

class ChartingPage extends Component {
    state = {
        exchange: "binance",
        coinpair: "BTC/USDT",
        coinpairs: []
    }

    interval = null;

    constructor(props) {
        super(props);
        this.setPendingCount.bind(this);
    }

    componentDidMount() {
        const exchange = sessionStorage.getItem('exchange') !== null ? sessionStorage.getItem('exchange') : 'binance';
        const coinpair = sessionStorage.getItem('coinpair') !== null ? sessionStorage.getItem('coinpair') : this.state.coinpair;

        const ex = new ccxt[exchange];
        
        if(ex.hasFetchOHLCV) {
            this.setState({exchange: exchange, coinpair: coinpair});   
            this.getCoinpairsForExhange(exchange);
        } else {
            this.getCoinpairsForExhange("binance");
        }
        
        const that = this;
        this.interval = setTimeout(function() {
            checkPendingTransactions(that.setPendingCount);
        }, 1000);
    }

    componentWillUnmount() {
        clearInterval(this.interval);
    }

    onChangeExchange(event) {
        const exchange = event.target.value;

        this.setState({exchange: exchange});

        sessionStorage.setItem('exchange', exchange);

        this.getCoinpairsForExhange(exchange);
    }

    onChangeCoinpair(event) {
        const coinpair = event.target.value;

        this.setState({coinpair: coinpair});

        sessionStorage.setItem('coinpair', coinpair);
    }

    async getCoinpairsForExhange(exchange_name) {
        const exchange = new ccxt[exchange_name]();
        exchange.proxy = backendHost + '/api/proxy/';

        try {
            await exchange.loadMarkets();
            
            let coinpairs = Object.keys(exchange.markets).map((market_name) => {
                const market = exchange.markets[market_name];
                return exchange.markets[market_name];
            });

            coinpairs = coinpairs.filter((coinpair) => { return coinpair != null});

            this.setState({coinpairs: coinpairs});
        } catch (e) {
            this.props.addErrorAlert("There are no markets available for " + exchange_name + "at this time.");
            this.setState({exchange: 'binance', coinpair: 'BTC/USDT'});
            sessionStorage.setItem('exchange', 'binance');

            this.getCoinpairsForExhange('binance');
        }
    }

    setPendingCount(count)  {
        this.setState({pending_count: count});
    }

    render() {
        let exchanges = ccxt.exchanges.map((exchange_name) => {
            const ex = new ccxt[exchange_name];
            return ex.hasPublicAPI && ex.hasFetchOHLCV ? exchange_name : null;
        });

        exchanges = exchanges.filter((exchange) => { return exchange != null});

        const that = this;

        let coinpairs = null;
        let tradingview_chart = null;
        if(this.state.coinpairs.length > 0) {
            coinpairs = this.state.coinpairs.map((coinpair) => {
                return <option key={coinpair.symbol} defaultValue={coinpair.id}>{coinpair.symbol}</option>;
            });

            tradingview_chart = <TradingViewChart {...this.props} exchange={this.state.exchange} symbol={this.state.coinpair} />;
        }

        
        

        let pending = null;
        if(this.state.pending_count > 0) {
            pending = <span>{this.state.pending} pending operations</span>
        }
        return (<div>
            
            <div className="col-md-12 padding-20">
                <section className="panel panel-default">
                    <header className="panel-heading">
                        <span className="panel-title elipsis">
                            <i className="fa fa-line-chart"></i> Crypto chart for {this.state.coinpair} {pending}
                        </span>
                        <label className="pull-right">
                            <select 
                                className="form-control pointer" 
                                id="change-coinpair" 
                                value={this.state.coinpair}
                                onChange={(e) => this.onChangeCoinpair(e)}
                            >
                                {coinpairs}
                            </select>
                        </label>
                        <label className="pull-right">
                            <select 
                                className="form-control pointer" 
                                id="change-exchange" 
                                value={this.state.exchange}
                                onChange={(e) => this.onChangeExchange(e)}
                            >
                                {exchanges.map((exchange_name) => {
                                    return <option key={exchange_name} value={exchange_name}>{exchange_name}</option>;
                                })}
                            </select>
                        </label>
                    </header>
                    <div className="panel-body noradius padding-10" style={{minHeight: "400px"}}>
                        {tradingview_chart}
                    </div>
                </section>
            </div>

        
        </div>

        );
    }
}

export default ChartingPage;