import arweave from '../../arweave-config';

const getIdeas = async (txids) => {
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

        if(!tx.hasOwnProperty('name')) {
            tx['name'] = tx.symbol + " Chart Idea";
        }

        if(tx.data_type === 'tv-chart-data') {
            return tx;
        } 
        
        return null;    
    }));

    return ideas.filter((idea) => { return idea !== null});
  }

  export default getIdeas;