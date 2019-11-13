import * as React from 'react';
import { widget } from '../../charting_library/charting_library.min';
import instance from '../../api-config';
import { timeParse } from "d3-time-format";
import { format } from "d3-format";
import * as actions from '../../store/actions/index';
import * as ccxt from 'ccxt';
import { connect } from 'react-redux';
import backendHost from '../../backend_host';

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

const history = {};

class SaveLoadAdapter {
	// getAllCharts() {
	// 	console.log(this);
	// }
	//
	// removeChart(chartId)  {
	// 	console.log("removechart: " + chartId);
	// }
	//
	// saveChart(chartData) {
	// 	console.log("saveChart: " + chartData);
	// }
	//
	// getChartContent(chartId) {
	// 	console.log("getChartContent: " + chartId);
	// }
	getAllStudyTemplates() {
		console.log("getAllStudyTemplates");
		return instance.get('/tv/chartstorage/1.1/');
	}
	removeStudyTemplate(studyTemplateInfo) {
		console.log("removeStudyTemplate: " + studyTemplateInfo);
	}
	saveStudyTemplate(studyTemplateData) {
		console.log("saveStudyTemplate: " + studyTemplateData);
	}
	getStudyTemplateContent(studyTemplateInfo) {
		console.log("getStudyTemplateContent: " + studyTemplateInfo);
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
	        supported_resolutions: ["5", "15", "60", "240"],
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

	searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
		//console.log(userInput, exchange, symbolType, onResultReadyCallback);
	}

	resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
		//console.log(symbolName, onSymbolResolvedCallback, onResolveErrorCallback);
		setTimeout(() => {
			onSymbolResolvedCallback(
				{
	        name: symbolName,
					description: '',
	        type: "bitcoin",
					supported_resolutions: ["5", "15", "60", "240"],
					data_status: 'streaming',
					session: '24x7',
					minmov: 1,
					pricescale: 100000000,
					has_intraday: true,
   				intraday_multipliers: ['5', '15', '60', "240"],
	    	}
			);
		}, 0);
	}

	async getBars(symbolInfo, resolution, from, to, onHistoryCallback, onErrorCallback, firstDataRequest) {
		// console.log(symbolInfo, resolution, from, to);
		let to_timestamp=to * 1000;
		const that = this;

		if(firstDataRequest) {
			to_timestamp=undefined;
			// console.log("first time");
		}

		const exchange_class_names = {
			binance: 'binance',
			hitbtc: 'hitbtc2',
			bittrex: 'bittrex'
		}

		const timescales = {
			240: "4h",
			60: "1h",
			5: "5m",
			15: "15m",
		};
		// console.log(this.props.exchange);
		const exchange_class_name = exchange_class_names[this.props.exchange]

		const exchange_class = ccxt[exchange_class_name];

		const exchange_instance = new exchange_class();
		exchange_instance.proxy = backendHost + '/api/proxy/';

		this.flip_candles = false;
		let symbol_name = symbolInfo.name;
		if(symbol_name.indexOf('1/') !== -1) {
			this.flip_candles = true;
			symbol_name = symbol_name.replace('1/', '');
		}

		const candles = await exchange_instance.fetchOHLCV(symbol_name, timescales[resolution], to_timestamp);

		let final_candles = candles.map(c => {
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
		this.stream = createStream(resolution, this.flip_candles, center_point);

		if(firstDataRequest) {
			const lastBar = final_candles[final_candles.length-1];
			// console.log(resolution, lastBar);
			const historic_bar = {lastBar: lastBar};
			// console.log(historic_bar);
			history[symbolInfo.name.replace('1/','').replace('/','') + "_" + resolution] = historic_bar;
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
			this.stream.subscribeBars(this, symbolInfo, this.exchange, resolution,onRealtimeCallback,subscriberUID,onResetCacheNeededCallback);
		//}
	}

	unsubscribeBars(subscriberUID)  {
		this.stream.unsubscribeBars(subscriberUID);
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
	          lastBar: history[symbolInfo.name.replace('1/','').replace('/','') + "_" + resolution].lastBar,
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
					if(datafeed.ws !== undefined) {
						this.ws = datafeed.ws;
					} else {
						this.ws = this.setupWebsocket(url);
					}

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
        	intervals: ["5", "15", "60", "240"]
    	}
	};

	state = {
		account: null
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

	

	createWidget() {
		const widgetOptions = {
			symbol: this.props.symbol,
			// BEWARE: no trailing slash is expected in feed URL
			datafeed: new DataFeed(this.props),
			save_load_adapter: new SaveLoadAdapter(this.props),
			interval: this.props.interval,
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

		if(this.ws) {
			this.ws.close();
		}
		const tvWidget = new widget(widgetOptions);
		this.tvWidget = tvWidget;
		widgetOptions.tvWidget = tvWidget;

		var that = this;

		tvWidget.onChartReady(() => {
			const buy_btn = tvWidget.createButton()
				.attr('title', 'Click to add a buy point')
				.addClass('apply-common-tooltip')
				.on('click', () => {
					var order = tvWidget.chart().createPositionLine()
						.setText('Buy ' + this.props.symbol)
						.setLineLength(3)
						.setLineStyle(0)
						.setQuantity("0.0823 " + this.props.symbol);

					order.setPrice(this.datafeed.history[this.props.symbol + "_" + this.props.interval.replace('m','').replace('h', '')].close);
				});

			buy_btn[0].innerHTML = 'BUY';

			const sell_btn = tvWidget.createButton()
				.attr('title', 'Click to add a buy point')
				.addClass('apply-common-tooltip')
				.on('click', () => {
					var order = tvWidget.chart().createOrderLine()
						.setText('Sell ' + this.props.symbol)
						.setLineLength(3)
						.setLineStyle(0)
						.setQuantity("0.0823 " + this.props.symbol);

					order.setPrice(this.datafeed.history[this.props.symbol].close);
				});

			sell_btn[0].innerHTML = 'SELL';


			// tvWidget.chart().removeAllStudies();
			tvWidget.chart().createStudy('Bollinger Bands', false, false);
			tvWidget.chart().createStudy('Moving Average', false, true, [8], null, {"%d.color" : "#FF0000"});
			tvWidget.chart().createStudy('Moving Average', false, true, [200], null, {"%d.color" : "#0000FF"});
			tvWidget.chart().createStudy('Moving Average', false, true, [314], null, {"%d.color" : "#FF0000"});
			tvWidget.chart().createStudy('Moving Average', false, true, [98], null, {"%d.color" : "#FF0000"});
			tvWidget.chart().createStudy('Moving Average', false, true, [466], null, {"%d.color" : "#FF0000"});
			tvWidget.chart().createStudy('Moving Average', false, true, [506], null, {"%d.color" : "#FF0000"});
			tvWidget.chart().createStudy('Moving Average', false, true, [804], null, {"%d.color" : "#FF0000"});
			tvWidget.chart().createStudy('Moving Average Exponential', false, true, [8], null, {"%d.color" : "#FFF000"});
			tvWidget.chart().createStudy('Moving Average Exponential', false, true, [13], null, {"%d.color" : "#FFF000"});
			tvWidget.chart().createStudy('Moving Average Exponential', false, true, [16], null, {"%d.color" : "#FFF000"});
			tvWidget.chart().createStudy('Moving Average Exponential', false, true, [21], null, {"%d.color" : "#FFF000"});
			tvWidget.chart().createStudy('Moving Average Exponential', false, true, [28], null, {"%d.color" : "#FFF000"});
			tvWidget.chart().createStudy('Moving Average Exponential', false, true, [35], null, {"%d.color" : "#FFF000"});
			tvWidget.chart().createStudy('Moving Average Exponential', false, true, [42], null, {"%d.color" : "#FFF000"});
			tvWidget.chart().createStudy('Moving Average Exponential', false, true, [50], null, {"%d.color" : "#FFF000"});
			tvWidget.chart().createStudy('Moving Average Exponential', false, true, [60], null, {"%d.color" : "#FFF000"});

			console.log(that.props.account);
			if(that.props.account !== null && that.props.account !== {}) {

				(async () => {
					const account_info = that.props.account.exchanges[0];
					const exchange = ccxt.binance({
						apiKey: account_info.api_key,
						apiSecret: account_info.api_secret
					});

					const trades = await exchange.fetchMyTrades(that.coin_pair)
					tvWidget.chart().createShape({time: Math.floor(new Date().valueOf() / 1000), price: 0.00242},
						{
							shape: "price_label",
							lock: true,
							disableSelection: true,
							disableSave: true,
							disableUndo: true,
							overrides: { color: "#00FF00" }
						}
					);
				});
				
			}
			
			

			const all_studies = tvWidget.chart().getAllStudies();
			for(let i in all_studies) {

				const study =  tvWidget.chart().getStudyById(all_studies[i].id);
				// console.log(study);
				// study.lock();
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

const mapDispatchToProps = dispatch => {
  return {
    onChangeCoinpair: (coin_pair) => dispatch(actions.setCoinPair(coin_pair))
  }
}

const mapStateToProps = state => {
  return {
	coin_pair: state.app.coin_pair
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(TradingViewChart);
