import React from 'react';
import Moment from 'react-moment';
import { Link } from 'react-router-dom';

const capitalize = (s) => {
    if (typeof s !== 'string') return ''
    return s.charAt(0).toUpperCase() + s.slice(1)
}

function Idea(props) {
    const created = new Date(props.created);
    const chartId = props.chartId;

    return (<>
        <div className="col-md-6 col-sm-6">
            <div className="box default">
                <div className="box-title">
                    <h4><Link to={{ pathname:'charts', chartid:chartId}}>{props.name}</Link></h4>
                    <small className="block">Exchange: {capitalize(props.exchange)}</small>
                    <small className="block">Symbol: {props.symbol}</small>
                    <i className="fa fa-bitcoin"></i>
                </div>
                <div className="box-body text-center">
                    <Moment date={created} format="YYYY/MM/DD"/>
                </div>
            </div>
        </div>
    </>);
}

export default Idea;