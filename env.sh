#!/bin/sh

# Define the directory where the env-config.js file should be created
DIR=/usr/share/nginx/html

# Recreate config file
rm -rf $DIR/env-config.js
touch $DIR/env-config.js

# Add assignment 
echo "window._env_ = {" >> $DIR/env-config.js

# Add values
echo "  REACT_APP_PIHOLE_BASE: '$REACT_APP_PIHOLE_BASE'," >> $DIR/env-config.js
echo "  REACT_APP_PIHOLE_KEY: '$REACT_APP_PIHOLE_KEY'," >> $DIR/env-config.js

echo "}" >> $DIR/env-config.js
