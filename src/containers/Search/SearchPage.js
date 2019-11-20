import React, { Component } from 'react';
import Idea from '../../components/Idea/Idea';
import getIdeas from '../../components/Idea/helpers';
import arweave from '../../arweave-config';
import settings from '../../app-config';


class SearchPage extends Component {
    state = {
        ideas: []
    }

    onChange(event)  {
        const search = event.target.value;

        this.searchIdeas(search);
    }

    async searchIdeas(search)  {
        if(search.length > 0) {
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
                    expr1: "data-type",
                    expr2: 'tv-chart-data'
                }
            });
            
            let ideas = await getIdeas(txids);

            ideas = ideas.filter((idea) => { return idea.name.toLowerCase().indexOf(search) != -1 || idea.symbol.toLowerCase().indexOf(search) != -1 });

            this.setState({ideas: ideas});
        } else {
            this.setState({ideas: []});
        }
        
    }

    render() {
        let ideas = null;

        if(this.state.ideas) {
            ideas = this.state.ideas.map((idea) => {
                return <Idea key={idea.created} columns={3} {...idea} />;
            })
        }

        return(<div>
            <header id="page-header">
                <h1>Search</h1>
            </header>
            <div className="col-md-12 padding-20">
                <section className="panel panel-default">
                    <header className="panel-heading">
                        <span className="panel-title pull-left margin-right-20 elipsis">
                            <i className="fa fa-search"></i> Search
                        </span>
                        <label className="pull-left">
                            <input type="text" onChange={(e) => this.onChange(e)} />
                        </label>
                        <div className="clearfix"></div>
                    </header>
                    <div className="panel-body noradius padding-10" style={{minHeight: "700px"}}>
                        <div className="row profile-activity">
                            {ideas}
                        </div>
                    </div>
                </section>
            </div>        
        </div>);
    }
}

export default SearchPage;