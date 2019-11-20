import * as React from 'react';
import { widget } from '../../charting_library/charting_library.min';
import { format } from "d3-format";
import backendHost from '../../backend_host';
import * as ccxt from 'ccxt';
import arweave from '../../arweave-config';
import settings from '../../app-config';
import './Tradingview.css';

function getLanguageFromURL() {
	const regex = new RegExp('[\\?&]lang=([^&#]*)');
	const results = regex.exec(window.location.search);
	return results === null ? null : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

const getCenterPoint = (candles) => {
	const highs = candles.map(c => {return c.high});
	const lows = candles.map(c => {return c.low});
	const highest = Math.max.apply(null, highs);
	const lowest = Math.min.apply(null, lows);
	return lowest + (highest - lowest);
}

const candle_history = {};

class SaveLoadAdapter {
	props = null;
	charts = [];
	templates = [];

	constructor(props) {
		this.props = {...props};
	}

	async getAllCharts() {
		const wallet_address = sessionStorage.getItem('AR_Wallet');
		const txids = await arweave.arql({
			op: "and",
			expr1: {
				op: "equals",
				expr1: "from",
				expr2: wallet_address
			},
			expr2: {
				op: "equals",
				expr1: "data-type",
				expr2: 'tv-chart-data'
			}
		});

		const charts = [];

		for(let i in txids) {
			const txid = txids[i];
			
			await arweave.transactions.getData(txid, {decode: true, string: true}).then(data => {
				const chart = JSON.parse(data);
				chart.id = JSON.parse(chart.content).publish_request_id;
				chart.name = this.decode(chart.name);
				charts.push(chart);
			});
		}   

		const that = this;

		return new Promise((resolve, reject) => {
			that.charts = [...charts];
			resolve(charts);
		});
	}
	
	removeChart(chartId)  {
	}
	
	async saveChart(chartData) {
		const jwk = JSON.parse(sessionStorage.getItem('AR_jwk'));

		let transaction = await arweave.createTransaction({
			data: JSON.stringify(chartData)
		}, jwk);

		const content = JSON.parse(chartData.content);

		

		transaction.addTag('app', settings.APP_TAG);
		transaction.addTag('created', new Date().getTime());
		transaction.addTag('data-type', 'tv-chart-data');
		transaction.addTag('exchange', this.props.exchange);
		transaction.addTag('symbol', chartData.symbol);
		transaction.addTag('chartId', content.publish_request_id);
		transaction.addTag('name', content.name);

		await arweave.transactions.sign(transaction, jwk);

		const response = await arweave.transactions.post(transaction);

		if(response.status === 200) {
			this.props.addSuccessAlert("Your chart was successfully saved and will be mined shortly.");

			this.addToPendingTransactions(transaction.id);

		} else if (response.status === 400) {
			this.props.addErrorAlert("There was a problem saving your chart.");
			console.log("Invalid transaction!");
		} else {
			this.props.addErrorAlert("There was a problem saving your chart.");
			console.log("Fatal error!");
		} 
	}
	
	
	async getChartContent(chartId) {
		if(this.charts.length > 0) {
			const charts = this.charts.filter((c) => c.id === chartId);
			return charts[0].content;
		}

		return null
	}

	async getChart(chartId) {
		const wallet_address = sessionStorage.getItem('AR_Wallet');
		const txids = await arweave.arql({
			op: "and",
			expr1: {
				op: "equals",
				expr1: "app",
				expr2: settings.APP_TAG
			},
			expr2: {
				op: "equals",
				expr1: "chartId",
				expr2: chartId
			}
					
		});

		const charts = await Promise.all(txids.map(async txid => {

			const transaction = await arweave.transactions.get(txid);
			const tags = transaction.get('tags');
			const data = JSON.parse(transaction.get('data', {decode: true, string: true}));
			const chart = JSON.parse(data.content);
			const content = JSON.parse(chart.content); // not sure why its like this but ... well ... its is! #weirdcoding

			const chart_tx = {txid: txid, chart: content.charts[0]};

			for(let i in tags) {
				const tag = tags[i];
				
				const name = tag.get('name', {decode: true, string: true}).replace('-', '_');
				let value = tag.get('value', {decode: true, string: true});

				if(name === "created") {
					value = parseInt(value);
				}

				chart_tx[name] = value;
			}

			

			return chart_tx; 
		}));

		return charts[0];
	}

	async getAllStudyTemplates() {
		const wallet_address = sessionStorage.getItem('AR_Wallet');
		const txids = await arweave.arql({
			op: "and",
			expr1: {
				op: "equals",
				expr1: "from",
				expr2: wallet_address
			},
			expr2: {
				op: "equals",
				expr1: "data-type",
				expr2: 'tv-study-template'
			}
		});

		const templates = [];

		for(let i in txids) {
			const txid = txids[i];
			
			await arweave.transactions.getData(txid, {decode: true, string: true}).then(data => {
				const json_data = JSON.parse(data);
				const escaped_data = {content: json_data.content, name: this.decode(json_data.name)};
				templates.push(escaped_data);
			});
		}   

		const that = this;

		return new Promise((resolve, reject) => {
			that.templates = [...templates];
			resolve(templates);
		});
	}

	decode(str) {
		return str.replace(/&#(\d+);/g, function(match, dec) {
			return String.fromCharCode(dec);
		});
	}

	removeStudyTemplate(studyTemplateInfo) {
		console.log("removeStudyTemplate: " + studyTemplateInfo);
		
	}
	async saveStudyTemplate(studyTemplateData) {
		console.log("saveStudyTemplate: " + studyTemplateData);

		const jwk = JSON.parse(sessionStorage.getItem('AR_jwk'));

		let transaction = await arweave.createTransaction({
			data: JSON.stringify(studyTemplateData)
		}, jwk);

		const content = JSON.parse(studyTemplateData.content);

		transaction.addTag('app', settings.APP_TAG);
		transaction.addTag('created', new Date().getTime());
		transaction.addTag('data-type', 'tv-study-template');
		transaction.addTag('name', content.name);

		await arweave.transactions.sign(transaction, jwk);

		const response = await arweave.transactions.post(transaction);

		if(response.status === 200) {
			this.props.addSuccessAlert("Your template was successfully saved and will be mined shortly.");

			this.addToPendingTransactions(transaction.id);

		} else if (response.status === 400) {
			this.props.addErrorAlert("There was a problem saving your template.");
			console.log("Invalid transaction!");
		} else {
			this.props.addErrorAlert("There was a problem saving your template.");
			console.log("Fatal error!");
		} 
	}
	async getStudyTemplateContent(studyTemplateInfo) {
		// console.log("getStudyTemplateContent: " + studyTemplateInfo);
		const templates = this.templates.filter((t) => t.name === studyTemplateInfo.name);
		return templates[0].content;
	}

	addToPendingTransactions(txid) {
        let pending_txids = JSON.parse(sessionStorage.getItem('pending_txids'));

        if(!pending_txids) {
            pending_txids = [];
        }

        pending_txids.push(txid);

        sessionStorage.removeItem('pending_txids');
        sessionStorage.setItem('pending_txids', JSON.stringify(pending_txids));
    }
}

class DataFeed {
	exchange = null;
	props = null;

	constructor(props) {
		this.exchange = props.exchange;
		this.props = props;
		if(this.props.websocket !== undefined) {
			this.ws = this.props.websocket;
		}
	}

	onReady(callback) {
		setTimeout(() => {
			callback(
				{
					supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W", "1M"],
					supports_group_request: false,
					supports_marks: false,
					supports_search: false,
							supports_time: true,
					supports_timescale_marks: false,
							exchanges: ['BINANCE'],
							symbol_types: ['bitcoin']
				}
			);
		}, 0);
	}

	searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {}

	resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
		setTimeout(() => {
			onSymbolResolvedCallback(
				{
	        name: symbolName,
					description: '',
	        type: "bitcoin",
					supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W", "1M"],
					data_status: 'streaming',
					session: '24x7',
					minmov: 1,
					pricescale: 100000000,
					has_intraday: true,
   				// intraday_multipliers: ['5', '15', '60', "240"],
	    	}
			);
		}, 0);
	}

	async getBars(symbolInfo, resolution, from, to, onHistoryCallback, onErrorCallback, firstDataRequest) {
		
		let to_timestamp = undefined;

		const that = this;

		const timeBar = candle_history[symbolInfo.name.replace('1/','').replace('/','') + "_" + resolution];

		if(firstDataRequest) {
			to_timestamp=undefined;
		} else {
			if(timeBar) {				
				const d = new Date(timeBar.firstBar[0]);
				d.setDate(d.getDate() - 3);
				d.setMilliseconds(0);
				to_timestamp = d.getTime();
			}
		}

		const timescales = {
			240: "4h",
			60: "1h",
			5: "5m",
			15: "15m",
			"1D": "1d",
			"M": "1M",
			"D": "1w"
		};

		const exchange_class = ccxt[this.props.exchange];

		const exchange_instance = new exchange_class();
		exchange_instance.proxy = backendHost + '/api/proxy/';

		let symbol_name = symbolInfo.name;

		let candles = await exchange_instance.fetchOHLCV(symbol_name, timescales[resolution], to_timestamp);

		if(!firstDataRequest) { 
			candles = candles.filter((candle) => candle[0] < timeBar.firstBar[0]);
		}

		const final_candles = candles.map(c => {
			return {
				time: c[0],
				open: c[1],
				high: c[2],
				low:  c[3],
				close:c[4],
				volume: c[5]
			}
		});

		if(candles.length > 0) {
			const firstBar = candles[0];
			const lastBar = candles[candles.length-1];

			const startDate = new Date(firstBar[0]);
			const endDate = new Date(lastBar[0]);

			console.log(startDate + " to " + endDate);
			const historic_bar = {lastBar: lastBar, firstBar: firstBar};

			candle_history[symbolInfo.name.replace('1/','').replace('/','') + "_" + resolution] = historic_bar;
		}

		if(final_candles.length) {
			onHistoryCallback(final_candles, {noData: false});
		} else {
			onHistoryCallback(final_candles, {noData: true});
		}
	}

	subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {}

	unsubscribeBars(subscriberUID)  {}

	calculateHistoryDepth(resolution, resolutionBack, intervalBack) {}

	getMarks(symbolInfo, from, to, onDataCallback, resolution) {}

	getTimescaleMarks(symbolInfo, from, to, onDataCallback, resolution) {}

	saveStudyTemplate(studyData) {}

	getServerTime(callback) {}
}

class TradingViewChart extends React.PureComponent {
	static defaultProps = {
		symbol: 'ADABNB',
		interval: "60",
		containerId: 'tv_chart_container',
		datafeedUrl: 'http://127.0.0.1:8000/api/tv',
		libraryPath: '/charting_library/',
		chartsStorageUrl: backendHost + '/tv/chartstorage',
		chartsStorageApiVersion: '1.1',
		clientId: 'tradingview.com',
		userId: 'public_user_id',
		fullscreen: false,
		autosize: true,
		studiesOverrides: {},
		disabled_features: [
			"create_volume_indicator_by_default",
			"volume_force_overlay",
      		"create_volume_indicator_by_default_once"
		],
		debug: false,
		favorites: {
        	intervals: ["5", "15", "60", "240", ""]
    	}
	};

	state = {
		account: null,
		interval: "60"
	}

	tvWidget = null;
	ws = null;

	componentDidUpdate(prevProps) {
		if(this.props.symbol !== undefined && this.props.symbol !== prevProps.symbol) {
			if (this.tvWidget !== null && this.tvWidget !== undefined) {
				this.tvWidget.remove();
				this.tvWidget = null;

				this.createWidget();
			}
		}
	}

	componentDidMount() {
		this.createWidget();
	}

	

	async createWidget() {
		const saveLoadAdapter = new SaveLoadAdapter(this.props);
		const widgetOptions = {
			symbol: this.props.symbol,
			// BEWARE: no trailing slash is expected in feed URL
			datafeed: new DataFeed(this.props),
			save_load_adapter: saveLoadAdapter,
			interval: this.state.interval,
			container_id: this.props.containerId,
			library_path: this.props.libraryPath,

			locale: getLanguageFromURL() || 'en',
			disabled_features: [],
			enabled_features: ['study_templates'],
			charts_storage_url: this.props.chartsStorageUrl,
			charts_storage_api_version: this.props.chartsStorageApiVersion,
			client_id: this.props.clientId,
			user_id: this.props.userId,
			fullscreen: this.props.fullscreen,
			autosize: this.props.autosize,
			studies_overrides: this.props.studiesOverrides,
			tvWidget: null
		};

		const tvWidget = new widget(widgetOptions);
		this.tvWidget = tvWidget;
		widgetOptions.tvWidget = tvWidget;

		var that = this;

		let chartid = null;
		

		tvWidget.onChartReady(async () => {
			if(that.props.location.hasOwnProperty('chartid')) { 
				const chart_state = await saveLoadAdapter.getChart(this.props.location.chartid);
				const chart = tvWidget.chart();
				tvWidget.load(chart_state.chart);

				that.props.setExchangeAndCoinpair(chart_state.exchange, chart_state.symbol)

				delete this.props.location.chartid;
			}
		});
	}

	componentWillUnmount() {
		if (this.tvWidget !== null) {
			this.tvWidget.remove();
			this.tvWidget = null;
		}
	}

	render() {
		return (
			<div
				style={this.props.style}
				id={ this.props.containerId }
				className={ 'TradingViewChart' }
			/>
		);
	}
}

export default TradingViewChart;
