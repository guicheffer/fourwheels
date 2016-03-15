var gulp = require('gulp'),
path = require('path'),
util = require('gulp-util'),
babelify = require('babelify'),
browserify = require('browserify'),
stylus = require('gulp-stylus'),
source = require('vinyl-source-stream'),
sourcemaps = require('gulp-sourcemaps'),
buffer = require('vinyl-buffer'),
uglify = require('gulp-uglify'),
imagemin = require('gulp-imagemin'),
pngquant = require('imagemin-pngquant'),
jpgtran = require('imagemin-jpegtran'),
run = require('gulp-run'),
es = require('event-stream');

/*GENERAL CONFIGS */
CONFIGS = {
  context: 'prod',
  app: 'fourwheels',
  version: '0.1',
  warnings: {
    successful: true
  },
  msgs: {
    dev: '##### You\'re in DEV context. #####',
    prod: '##### You\'re in PROD context. #####',
    type: {
      warn: '➜ WARNING: '
    }
  }
};

/*GENERAL SETTINGS */
SETTINGS = {
  app: {
    name: CONFIGS.app,
    version: CONFIGS.version
  },
  config: {
    notifier: './node_modules/terminal-notifier/terminal-notifier.app/Contents/MacOS/terminal-notifier',
    warnings: {
      successful: CONFIGS.warnings.successful
    },
    styles: {
      compress: true
    },
    scripts: {
      presets: 'es2015',
      debug: false
    },
    images: {
      quality: '90-100',
      progressive: true
    }
  },
  context: CONFIGS.context,
  root: './site/wp-content/themes/' + CONFIGS.app + '/',
  path: {
    static: 'static/',
    dist: 'dist/',
    minified: 'min/',
    images: 'images/',
    assets: 'assets/',
    scripts: 'js/',
    styles: 'css/'
  },
  msgs: {
    warning: {
      prod: CONFIGS.msgs.type.warn + CONFIGS.msgs.prod,
      dev: CONFIGS.msgs.type.warn + CONFIGS.msgs.dev
    }
  }
};

/*GENERAL PATHS */
var base = {
  src: path.join(SETTINGS.root, SETTINGS.path['static']),
  dist: path.join(SETTINGS.root, SETTINGS.path['static'])
},
PATHS = {
  root: {
    src: SETTINGS.root
  },
  styles: {
    src: path.join(base.src, SETTINGS.path.styles, SETTINGS.app.version, SETTINGS.path.assets),
    dist: path.join(base.dist, SETTINGS.path.styles, SETTINGS.app.version, SETTINGS.path.minified)
  },
  scripts: {
    src: path.join(base.src, SETTINGS.path.scripts, SETTINGS.app.version, SETTINGS.path.assets),
    dist: path.join(base.dist, SETTINGS.path.scripts, SETTINGS.app.version, SETTINGS.path.minified)
  },
  images: {
    src: path.join(base.src, SETTINGS.path.images, SETTINGS.path.assets),
    dist: path.join(base.dist, SETTINGS.path.images, SETTINGS.path.dist)
  }
};

/*DEV CONDITION */
if (util.env.dev) {
  SETTINGS.context = 'dev';
  SETTINGS.config.styles.compress = false;
  SETTINGS.config.scripts.debug = true;
  SETTINGS.config.warnings.successful = false;
  uglify = util.noop;
} else {
  sourcemaps.init = util.noop;
  sourcemaps.write = util.noop;
}


/*FUNCTIONS*/
function terminal_notifier(name, title, subtitle, msg){
  run(SETTINGS.config.notifier + ' \
    -title "' + title + '" -message "' + msg.toString() + '" \
    -subtitle "' + subtitle + '" -activate "com.apple.terminal" \
    -group "' + name + '" -remove "' + name + '"').exec()
    .on('error', function(){this.emit('end')});
}


/*STYLUS */
gulp.task('stylus', function() {
  gulp.src(path.join(PATHS.styles.src, '**/*.styl'))
    .pipe(sourcemaps.init())
    .pipe(stylus({
      compress: SETTINGS.config.styles.compress
    }))
    .on('error', function(err){
      util.log(
        util.colors.cyan("Stylus error:"), 
        util.colors.red(err.message)
      );
      terminal_notifier('stylus', '❌ Stylus', 'Error', err.toString());
      this.emit('end');
    })
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(PATHS.styles.dist));
  
  if(SETTINGS.config.warnings.successful){
    terminal_notifier('stylus', '✅ Stylus', '', 'Compiled');
  }
});


/*BABEL*/
gulp.task('babel', function() {
  var files = [{
    src: path.join(PATHS.scripts.src, 'common/common.js'),
    dest: 'common/common.js'
  },{
    src: path.join(PATHS.scripts.src, 'showcase/app.js'),
    dest: 'showcase/app.js'
  }];
  
  var tasks = files.map(function(entry) {
    browserify({entries: [entry.src], debug: SETTINGS.config.scripts.debug})
      .transform('babelify', {presets: [SETTINGS.config.scripts.presets]})
      .bundle()
      .on('error', function(err){
        util.log(
          util.colors.cyan("Browserify compile error:"), 
          util.colors.red(err.message)
        );
        terminal_notifier('babel', '❌ Babel', 'Error', err.toString());
        this.emit('end');
      })
      .pipe(source(entry.dest))
      .pipe(buffer())
      .pipe(uglify())
      .pipe(gulp.dest(PATHS.scripts.dist));
  });
  
  if(SETTINGS.config.warnings.successful){
    terminal_notifier('babel', '✅ Babel', '', 'Compiled');
  }
});


/*IMAGE MIN */
gulp.task('image-min', function() {
  gulp.src(path.join(PATHS.images.src, '**/*.*')).pipe(imagemin({
    use: [
      pngquant({
        quality: SETTINGS.config.images.quality
      }), jpgtran({
        progressive: SETTINGS.config.images.progressive
      })
    ]
  })).pipe(gulp.dest(PATHS.images.dist));
});


/*GULP SERVE */
gulp.task('serve', ['stylus', 'babel'], function() {
  gulp.watch(path.join(PATHS.styles.src, '**/*.styl'), ['stylus']);
  gulp.watch(path.join(PATHS.scripts.src, '**/*.js'), ['babel']);
  console.info(SETTINGS.msgs.warning[SETTINGS.context]);
});


/*GULP TASKS */
gulp.task('build', ['stylus', 'babel', 'image-min']);
gulp.task('build-assets', ['stylus', 'babel']);
gulp.task('run', ['serve']);
gulp.task('default', ['run']);