const $ = require('./zepto_custom');

class util {
  constructor(){
    this._el_no_href = '.js-no-href';
  }
  
  block_links(){
    $(this._el_no_href).click(function(){return false});
  }
  
  init(){
    this.block_links();
  }
}

export default util;