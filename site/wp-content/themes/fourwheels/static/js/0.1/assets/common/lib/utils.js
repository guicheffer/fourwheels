const $ = require('./zepto_custom');

class util {
  constructor(){
    // FIXME: just get this done asap (animate showing up to the user)
    this._el_items_more = '.nav-items-more';
    this._el_items_more_target = '#target';
  }
  
  block_links(){
    $('.js-no-href').click(function(){return false});
  }
  
  init(){
    this.block_links();
  }
}

export default util;