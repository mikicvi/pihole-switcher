#!/bin/sh

# Define the directory where the env-config.js file should be created
DIR=/usr/share/nginx/html

# Recreate config file
echo "window._env_ = {" > $DIR/env-config.js
echo "  REACT_APP_PIHOLE_BASE: \"$REACT_APP_PIHOLE_BASE\"," >> $DIR/env-config.js
echo "  REACT_APP_PIHOLE_ADMIN: \"${REACT_APP_PIHOLE_ADMIN:-}\"," >> $DIR/env-config.js
echo "  REACT_APP_PIHOLE_PASSWORD: \"$REACT_APP_PIHOLE_PASSWORD\"" >> $DIR/env-config.js
echo "}" >> $DIR/env-config.js

# Substitute the Pi-hole proxy target in the nginx config (used by the /api/
# reverse proxy). Defaults to 172.17.0.1, the Docker host gateway — the
# typical location of a Pi-hole running on the host machine.
sed -i "s/\${PIHOLE_PROXY_TARGET}/${PIHOLE_PROXY_TARGET:-172.17.0.1}/g" /etc/nginx/conf.d/default.conf
