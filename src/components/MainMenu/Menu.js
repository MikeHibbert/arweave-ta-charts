import React, { Component } from 'react';
import MenuItem from './MenuItem';


class Menu extends Component {
  render() {
    return (
      <>
        <nav id="sideNav">
            <ul className="nav nav-list">
              <MenuItem icon='home' name='Home' url='/' {...this.props}/>
              <MenuItem icon='line-chart' name='Charting' url='/charts' {...this.props}/>
              <MenuItem icon='search' name='Search' url='/search' {...this.props}/>
            </ul>
        </nav>
        <span id="asidebg"></span>
    </>
    );
  }
}

export default Menu;
