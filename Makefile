help:
	@echo "Please use 'make <target>' where <target> is one of"
	@echo "  update		=> update branches uat/master"

update:
	git checkout master
	git pull origin master --rebase
	# git checkout uat

uploads:
	@echo "Downloading/updating uploads from Guiatech server ..."
	@echo ""
	@echo "[type guiatech's server password]"
	@cd site/wp-content/ && mkdir -p uploads/ && cd uploads/ && rsync -avz -e 'ssh -p 2222' dgjolero@guiatech.com.br:~/www/live/tests.guiatech.com.br/fourwheels/site/wp-content/uploads/ .

clone-configs:
	cp site/wp-guiatech-config/.htaccess site/.htaccess
	cp site/wp-guiatech-config/wp-config.php site/wp-config.php
	@echo "!!!!!!! Congratulations!, now... edit your local config files! (.htaccess AND site/wp-config.php) !!!!!"

serve: uploads clone-configs

gource:
	gource -f -1920x1080 -s 1 --user-image-dir .git_avatars --disable-auto-rotate --title "Guia tech - Four Wheels"  --file-extensions --user-scale 2 -i 10000 --max-file-lag 10000 -r 30 --date-format "%Y-%m-%d"
