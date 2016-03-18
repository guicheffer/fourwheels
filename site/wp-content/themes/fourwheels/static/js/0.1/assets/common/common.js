/**
 * Common.js for neymar jr experience (common) Zepto.js plugin v1.1.6
 * V: [0.1 (fourwheels)]
 * http://tests.guiatech.com.br/fourwheels/site/
 * Copyright 2016, Knowledge
 * Author: Joao Guilherme C. Prado
 * Dep. of Library: Zepto.js v1.1.6 w/ ES6
 *
 * Usually used for scripts in four wheels wordpress website (homepage-only [today])
 *
 * Date: Mon Mar 14 2016 21:27:19 GMT-0300
 */

const njr = njr || {};
const $ = require('./lib/zepto_custom');

import _utils from './lib/utils';
import _gui from './lib/gui';

let util = new _utils();
let gui = new _gui();

$(function(){
  util.init();
  gui.init();
});