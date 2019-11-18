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

const flip = (final_candles, center_point) => {
	const new_candles = [];
	for(let i in final_candles) {
		const candle = {
			time: final_candles[i].time,
			open: flipValue(final_candles[i].open, center_point),
			high: flipValue(final_candles[i].high, center_point),
			low:  flipValue(final_candles[i].low, center_point),
			close:flipValue(final_candles[i].close, center_point),
			volume: final_candles[i].volume
		};

		new_candles.push(candle);
	}

	return new_candles;
}

const flipValue = (value, center_point) => {
	let result = 0;
	const satoshiFormat = format('.10f');
	if(value > center_point) {
		result = value - ((value - center_point) * 2);
	} else {
		result = value + ((center_point - value) * 2);
	}

	// console.log("Flipped " + value + " around " + center_point + " to give " + result);

	return parseFloat(satoshiFormat(result));
}

const candle_history = {};

class SaveLoadAdapter {
	props = null;

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
		const charts = this.charts.filter((c) => c.id === chartId);

		return charts[0].content;
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
	exchange : null;
	props: null;
	ws: null;
	flip_candles: false;
	centre_point: 0;

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

		this.flip_candles = false;
		let symbol_name = symbolInfo.name;
		if(symbol_name.indexOf('1/') !== -1) {
			this.flip_candles = true;
			symbol_name = symbol_name.replace('1/', '');
		}

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

		let center_point = 0;
		if(this.flip_candles) {
			center_point = getCenterPoint(final_candles);
			final_candles = flip(final_candles, center_point);
		}

		// console.log(center_point);
		// this.stream = createStream(resolution, this.flip_candles, center_point);

		if(candles.length > 0) {
			const firstBar = candles[0];
			const lastBar = candles[candles.length-1];

			const startDate = new Date(firstBar[0]);
			const endDate = new Date(lastBar[0]);

			console.log(startDate + " to " + endDate);
			const historic_bar = {lastBar: lastBar, firstBar: firstBar};
			// console.log(historic_bar);
			candle_history[symbolInfo.name.replace('1/','').replace('/','') + "_" + resolution] = historic_bar;
		}

		if(final_candles.length) {
			onHistoryCallback(final_candles, {noData: false});
		} else {
			onHistoryCallback(final_candles, {noData: true});
		}



		// const url = '/tv/?symbol=' + symbolInfo.name + '&exchange=' + this.exchange + '&resolution=' + resolution + '&from=' + from + '&to=' + to_timestamp;
		// instance.get(url)
		// 	.then(response => {
		// 		// console.log(response.data);
		// 		if(response.data.length) {
		// 			if(firstDataRequest) {
		// 				const lastBar = response.data[response.data.length-1];
		// 				const historic_bar = {lastBar: lastBar};
		// 				console.log(historic_bar);
		// 				history[symbolInfo.name.replace('/','')]= historic_bar;
		// 			}
		// 			onHistoryCallback(response.data, {noData: false});
		// 		} else {
		// 			onHistoryCallback({noData: true});
		// 		}
		//
		// 	})
		// 	.catch(error => {
		// 		console.log(error);
		// 		onErrorCallback(error);
		// 	})
	}

	subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
		//if(!this.flip_candles) {
			// this.stream.subscribeBars(this, symbolInfo, this.exchange, resolution,onRealtimeCallback,subscriberUID,onResetCacheNeededCallback);
		//}
	}

	unsubscribeBars(subscriberUID)  {
		// this.stream.unsubscribeBars(subscriberUID);
	}

	calculateHistoryDepth(resolution, resolutionBack, intervalBack) {

	}

	getMarks(symbolInfo, from, to, onDataCallback, resolution) {

	}

	getTimescaleMarks(symbolInfo, from, to, onDataCallback, resolution) {

	}

	saveStudyTemplate(studyData) {
		console.log(studyData);
	}

	getServerTime(callback) {

	}
}

let _subs = [];

const createStream = function(resolution, flip, center_point) {

	// console.log(center_point);
	return {
		ws:null,
		exchange: null,
		commands: [],
		resolution: resolution,
		flip: flip,
		center_point: center_point,
		chart: null,
		url: null,
		subscribeUID: null,

		setWidget: function(chart) {
			this.chart = chart;
		},

	  subscribeBars: function(datafeed, symbolInfo, exchange, resolution, onRealtimeCallback, subscribeUID, onResetCacheNeededCallback) {
	      let channelString = symbolInfo.name.replace('1/','').replace('/','') + "-" + exchange;
				console.log(subscribeUID);
				this.subscribeUID = subscribeUID;
	      let newSub = {
	          channelString,
	          subscribeUID,
	          resolution,
	          lastBar: candle_history[symbolInfo.name.replace('1/','').replace('/','') + "_" + resolution].lastBar,
	          listener: onRealtimeCallback,
	      };
	      _subs.push(newSub);

				// console.log(newSub);

				let url = null;
				this.exchange = exchange;

				if(exchange == "binance") {
					const timescales = {
						240: "4h",
						60: "1h",
						5: "5m",
						15: "15m",
					};

					this.resolution = timescales[resolution];
					//console.log(this.resolution);

					url = "wss://stream.binance.com:9443/ws/" + symbolInfo.name.replace('1/','').replace('/','').toLowerCase() + "@kline_" + timescales[resolution];
					this.url = url;
				}
				// if(exchange == "hitbtc") {
				// 	const timescales = {
				// 		60: "M60",
				// 		5: "M5",
				// 		15: "M15",
				// 	};
				//
				// 	url = "wss://api.hitbtc.com/api/2/ws";
				// 	this.commands = [];
				// 	this.commands.push(
				// 		{
				// 		  method: "subscribeCandles",
				// 		  params: {
				// 		    symbol: symbolInfo.name.replace('/',''),
				// 		    period: timescales[resolution],
				// 		    limit: 100
				// 		  },
				// 		  id: Math.random()
				// 		}
				// 	)
				// 	// console.log(this.commands);
				// }

				if(this.ws) {
					this.ws.close();
				}
				if(exchange) {
					// if(datafeed.ws !== undefined) {
					// 	this.ws = datafeed.ws;
					// } else {
					// 	this.ws = this.setupWebsocket(url);
					// }

				}
	  },

		setupWebsocket: function(url) {
			if(this.ws) {
				this.ws.close();
			}

	    let websocket = new WebSocket(url);
	    websocket.onopen = () => {
	      console.log('TV Websocket connected on ' + this.resolution);
				if(this.commands.length > 0) {
					for(let i in this.commands) {
						const command = this.commands[i];
						this.ws.send(JSON.stringify(command));
					}
				}
	    };


	    websocket.onmessage = (evt) => {
				// console.log(this.resolution);
	      this.handleData(evt);
	    };


	    websocket.onclose = () => {
	      console.log('TV Websocket disconnected from ' + this.resolution);
	    }

			websocket.onerror = (errors) => {
				console.log('TV Websocket error: ' + errors);
			}

	    return websocket;
	  },

		handleData: function(event) {
			const data = JSON.parse(event.data);

			// console.log(data);
			const timescales = {
				"4h":240,
				"1h":60,
				"5m":5,
				"15m":15,
			};

			//console.log(data);
			// if(data.hasOwnProperty('method')) {
			// 	if(data.method === 'updateCandles') {
			// 		console.log("updateCandles call");
			// 		const symbol = data.symbol;
			// 		const candle = {
			// 			c: data.params.data['close'],
			// 			v: data.params.data['volumeQuote'],
			// 			t: new Date(data.params.data['timestamp']).getTime() * 1000
			// 		}
			//
			// 		if(this.flip) {
			// 			candle.c = flipValue(parseFloat(candle.c), this.centre_point);
			// 		}
			// 		const channelString = symbol + "-" + this.exchange;
			// 		const sub = _subs.find(e => e.channelString === channelString && e.subscribeUID === this.subscribeUID);
			// 		//console.log(sub);
			// 		if (sub) {
		  // // disregard the initial catchup snapshot of trades for already closed candles
			// 		  if (data.t < sub.lastBar.time / 1000) {
			// 	    	return
			// 	    }
			//
			// 			 var _lastBar = this.updateBar(candle, sub);
			//
			// 		// send the most recent bar back to TV's realtimeUpdate callback
			// 		  sub.listener(_lastBar)
			// 		  // update our own record of lastBar
			// 		  sub.lastBar = _lastBar
			// 		}
			// 	}
			// }
			if(data.e === "kline") {
				// console.log("kline call");
				const symbol = data.s;
				let candle = data.k;
				const resolution = timescales[candle.i];
				//console.log(this.resolution, resolution);

				// if(this.resolution === resolution) {
					const channelString = symbol + "-" + this.exchange;
					const sub = _subs.find(e => e.channelString === channelString && e.subscribeUID === this.subscribeUID);
					//console.log(sub);
					if (sub) {
		  // disregard the initial catchup snapshot of trades for already closed candles
					  if (data.t < sub.lastBar.time / 1000) {
				    	return
				    }

						//console.log(this.center_point);
						if(this.flip) {

							candle = {
								t: candle.t,
								c: flipValue(parseFloat(candle.c), this.center_point),
								v: candle.v
							};
						}
						//console.log(sub);

						 var _lastBar = this.updateBar(candle, sub);

					// send the most recent bar back to TV's realtimeUpdate callback
					  sub.listener(_lastBar)
					  // update our own record of lastBar
					  sub.lastBar = _lastBar
					}
				}
			//}
			// console.log(_subs);
		},

		updateBar: function(data, sub) {
			var lastBar = {...sub.lastBar};
			//console.log("sub", sub);
			//console.log(lastBar);
			let resolution = sub.resolution
			if (resolution.includes('D')) {
			 // 1 day in minutes === 1440
			 resolution = 1440
			} else if (resolution.includes('W')) {
			 // 1 week in minutes === 10080
			 resolution = 10080
			}
			var coeff = resolution * 60

			var rounded = Math.floor(data.t / coeff) * coeff
			var lastBarSec = lastBar.time
			var _lastBar;

			data.c = parseFloat(data.c);

			//console.log(data, lastBar);
			// console.log(rounded, data.t);
			if (rounded > lastBarSec) {
				  // create a new candle, use last close as open **PERSONAL CHOICE**
					//console.log(rounded, data.t);

			   _lastBar = {
				   time: rounded,
				   open: lastBar.close,
			     high: lastBar.close,
				   low: lastBar.close,
				   close: data.c,
				   volume: data.v
				 };

			} else {
			  // update lastBar candle!
			   if (data.c < lastBar.low) {
			     lastBar.low = data.c;
			   } else if (data.c > lastBar.high) {
			     lastBar.high = data.c;
			   }


			   lastBar.volume = data.v;
			   lastBar.close = data.c;
			   _lastBar = lastBar;
			}
			 return _lastBar
		 },

		close: function() {
			this.ws.close();
		},

	  unsubscribeBars: function(uid) {
	    // Note, here to clear the previous subscription
	    console.log('=====unsubscribeBars uid ='+uid);
	    var subIndex = _subs.findIndex(e => e.subscribeUID === uid);
	    if (subIndex === -1) {
	        //console.log("No subscription found for ", uid)
	        return;
	    }
	    //var sub = _subs[subIndex]
	    _subs.splice(subIndex, 1)

			if(this.ws) {
				this.ws.close();
			}
	  }
	};
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
		const widgetOptions = {
			symbol: this.props.symbol,
			// BEWARE: no trailing slash is expected in feed URL
			datafeed: new DataFeed(this.props),
			save_load_adapter: new SaveLoadAdapter(this.props),
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
		if(this.props.location.hasOwnProperty('chartid')) {
			await tvWidget.chart().getAllCharts();
			await tvWidget.chart().getChartContent(this.props.location.chartid);
		}

		tvWidget.onChartReady(() => {

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
