import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import arweave from '../../arweave-config';
import settings from '../../app-config';
import Spinner from '../../components/Spinner/Spinner';
import Idea from '../../components/Idea/Idea';
import { stat } from 'fs';

class HomePage extends Component {

  state = {
    current_balance: 0.0,
    measure_enabled: false,
    account: null,
    my_ideas: [],
    latest_ideas: [],
    loading: true
  }

  async componentDidMount() {
    this.arqlSearchIdeas(
        {
            op: "and",
            expr1: {
                op: "equals",
                expr1: "from",
                expr2: this.props.wallet_address
            },
            expr2: {
                op: "equals",
                expr1: "app",
                expr2: settings.APP_TAG
            }
        },
        "my_ideas"
    )

    this.arqlSearchIdeas(
        {
            op: "equals",
            expr1: "app",
            expr2: settings.APP_TAG
        },
        "latest_ideas",
        true
    )
  }  

  async arqlSearchIdeas(search, state_name, ends_process=false) {
    const txids = await arweave.arql(search);

    if(txids.length === 0) {
        if(ends_process) {
            this.setState({loading: false});
        }
    }

    const ideas = await this.getIdeas(txids);

    const state = {};

    state[state_name] = ideas;
    
    if(ends_process) {
      state['loading'] = false;  
    } 
    
    this.setState(state);
  }

  async getIdeas(txids) {
    const ideas = await Promise.all(txids.map(async txid => {
        const transaction = await arweave.transactions.get(txid);
        const tags = transaction.get('tags');
        
        const tx = {txid: txid};

        for(let i in tags) {
            const tag = tags[i];
            
            const name = tag.get('name', {decode: true, string: true}).replace('-', '_');
            let value = tag.get('value', {decode: true, string: true});

            if(name === "created") {
                value = parseInt(value);
            }

            tx[name] = value;
        }

        if(tx.data_type === 'tv-chart-data') {
            return tx;
        } 
        
        return null;    
    }));

    return ideas.filter((idea) => { return idea !== null});
  }

  render() {
    let my_ideas = [];
    let latest_ideas = [];

    if(this.state.loading) {
        my_ideas = [<Spinner key={1} />];
        latest_ideas = [<Spinner key={2} />];
    }

    if(this.state.my_ideas.length > 0) {
        my_ideas = this.state.my_ideas.map((idea) => {
            return <Idea key={idea.created} {...idea} />
        });
    }

    const now = new Date();
    const a_week_ago = now.setDate(now.getDate() - 7);

    if(this.state.latest_ideas.length > 0) {
        latest_ideas = this.state.latest_ideas.map((idea) => {
            return idea.created > a_week_ago ? <Idea key={idea.created} {...idea} /> : null;
        });

        latest_ideas = latest_ideas.filter((idea) => { return idea != null});
    }

    return ( <div>
        <header id="page-header">
            <h1>Home</h1>
        </header>
        <div className="col-md-6 padding-20">
            <section className="panel panel-default">
                <header className="panel-heading">
                    <h2 className="panel-title elipsis">
                        <i className="fa fa-info-circle"></i> My Ideas
                    </h2>
                </header>
                <div className="panel-body noradius padding-10" style={{minHeight: "700px"}}>
                    <div className="row profile-activity">
                        {my_ideas}
                    </div>
                </div>
            </section>
        </div>
        <div className="col-md-6 padding-20">
            <section className="panel panel-default">
                <header className="panel-heading">
                    <h2 className="panel-title elipsis">
                        <i className="fa fa-rss"></i> Latest Ideas 
                    </h2>
                </header>
                <div className="panel-body noradius padding-10" style={{minHeight: "700px"}}>
                    <div className="row profile-activity">
                        {latest_ideas}
                    </div>
                </div>
            </section>
        </div>
    
    </div>);
  }

}

export default HomePage;