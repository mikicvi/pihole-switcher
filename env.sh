#!/bin/sh

# Define the directory where the env-config.js file should be created
DIR=/usr/share/nginx/html

# Recreate config file
echo "window._env_ = {" > $DIR/env-config.js
echo "  REACT_APP_PIHOLE_BASE: \"$REACT_APP_PIHOLE_BASE\"," >> $DIR/env-config.js
echo "  REACT_APP_PIHOLE_PASSWORD: \"$REACT_APP_PIHOLE_PASSWORD\"" >> $DIR/env-config.js
echo "}" >> $DIR/env-config.js
