const $ = require('./zepto_custom');

class gui {
  constructor(){
    this._el_list_top_menu = '.list-top-menu';
    this._el_open_menu = '.js-open-menu';
    this._el_open_menu_search = '.js-open-menu-search';
    this._el_target_open_menu = this._el_list_top_menu;
    this._el_target_open_menu_search = '.js-search-text';
    this._el_item_named = '.item-named';
  }
  
  hide_menu(){
    $('body').removeClass('menu-opened');
    $(this._el_target_open_menu).fadeOut();
    $(this._el_open_menu).removeClass('selected');
  }
  
  show_menu(){
    $('body').addClass('menu-opened');
    $($(this._el_target_open_menu)
      .fadeIn()
      .find('input')).focus();
    $(this._el_open_menu).addClass('selected');
  }
  
  open_menu(){
    $('body').unbind().click((_)=>{
      console.log(_.target.id === 'no-hide');
      if( _.target.id !== 'no-hide' ){
        this.hide_menu();
      }
    });
    
    $(this._el_open_menu).unbind().click((_) => {
      if( $(_.currentTarget).hasClass('selected') ){
        this.hide_menu();
      }else{
        this.show_menu();
      }
    })
  }
  
  open_menu_search(){
    $(this._el_open_menu_search).unbind().click((_) => {
      if( $(_.currentTarget).hasClass('selected') ){
        $(this._el_target_open_menu_search).fadeOut();
        $(_.currentTarget).removeClass('selected');
      }else{
        this.hide_menu();
        
        $($(this._el_target_open_menu_search)
          .fadeIn()
          .find('input')).focus();
        $(_.currentTarget).addClass('selected');
      }
    })
  }
  
  close_individually_item_menu(){
    $($(this._el_list_top_menu).find(this._el_item_named)).each((i, el) => {
      $(el).removeClass('selected');
    });
  }
  
  open_and_close_item_menu(){
    let _el_item_named = this._el_item_named,
    _el_a_item_named = _el_item_named + ' > a';
    
    $($(this._el_list_top_menu).find(_el_a_item_named)).each((i, el) => {
      $(el).unbind().click((_) => {
        this.close_individually_item_menu();
        $(_.currentTarget).parent(_el_item_named).addClass('selected');
      });
    });
  }
  
  activate_responsive(){
    if( $(window).width() <= 890 ){
      this.open_menu();
      this.open_menu_search();
      this.open_and_close_item_menu();
    }else{
      if( $(this._el_target_open_menu).css('display') === 'none' ){
        this.show_menu();
      }
    }
  }
  
  change_resize(){
    $(window).on('resize', () => {
      this.activate_responsive();
    });
  }
  
  init(){
    this.change_resize();
    this.activate_responsive();
  }
}

export default gui;