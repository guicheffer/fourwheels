<?php
/**
 * The main template file
 *
 * @package GuiaTech
 * @subpackage Four_Wheels
 * @since "'Quatro Rodas' - Abril" 2016 (test for interview)
 */

$title = get_bloginfo('title');
$subtitle = 'Home';

$chartset = 'UTF-8';
$theme_color = '#ED1C24';

?>
<!--[if IE 7]>         <html class="ie ie7 ltie11 ltie10 ltie9 ltie8 lang-pt" lang="pt" prefix="og: http://ogp.me/ns#">           <![endif]-->
<!--[if IE 8]>         <html class="ie ie8 gtie7 ltie11 ltie10 ltie9 lang-pt" lang="pt" prefix="og: http://ogp.me/ns#">           <![endif]-->
<!--[if IE 9]>         <html class="ie ie9 gtie7 gtie8 ltie11 ltie10 lang-pt" lang="pt" prefix="og: http://ogp.me/ns#">           <![endif]-->
<!--[if gt IE 9]><!--> <html class="gtie9 not-really-ie lang-pt" lang="pt" prefix="og: http://ogp.me/ns#"><!--<![endif]-->
<head>
    <!--[if IE]><meta http-equiv="X-UA-Compatible" content="IE=EmulateIE8"><![endif]-->
    <meta charset="<?=$charset;?>" />
    <meta name="theme-color" content="<?=$theme_color?>" />
    <meta name="robots" content="index,follow" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="author" content="guicheffer" />
    <meta name="keywords" content="abril, quatro rodas" />
    <meta name="description" content='An example of how "quatro rodas" wordpress website would be in practice if it was responsively styled. (not indexable)' />

    <link rel="canonical" href="<?=get_page_link()?>" />
    
    <link type="text/css" rel="stylesheet" href="<?=get_template_directory_uri()?>/static/css/0.1/min/common/base.css"/>
    <link type="text/css" rel="stylesheet" href="<?=get_template_directory_uri()?>/static/css/0.1/min/home/style.css"/>
    
<?php include('includes/head.inc.php') ?>
    
<?php get_header() ?>

        <main id="content" class="content content-section" role="content">
            <a class="accessibility-aid" id="view">Ver conteúdo</a>
            
            <?php include('includes/news.inc.php') ?>
        </main>

<?php get_footer() ?>