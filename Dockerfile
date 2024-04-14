# Use an official Nginx runtime as the base image
FROM nginx:alpine

# Copy the built React app into the Nginx server's default HTML directory
COPY build/ /usr/share/nginx/html

# Copy the shell script
COPY env.sh /usr/share/nginx/html

# Make the script executable
RUN chmod +x /usr/share/nginx/html/env.sh

# Expose port 80 (the default HTTP port)
EXPOSE 80

# Start Nginx to serve the app
CMD ["/bin/sh", "-c", "/usr/share/nginx/html/env.sh && nginx -g 'daemon off;'"]