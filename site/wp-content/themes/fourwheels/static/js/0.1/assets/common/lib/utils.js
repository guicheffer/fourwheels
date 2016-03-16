const $ = require('./zepto_custom');

class util {
  block_links(){
    $('.js-no-click').click(function(){return false});
  }
  
  init(){
    this.block_links();
  }
}

export default util;