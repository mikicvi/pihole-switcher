# Use an official Nginx runtime as the base image
FROM nginx:alpine

# Copy the built React app into the Nginx server's default HTML directory
COPY build/ /usr/share/nginx/html

# Expose port 80 (the default HTTP port)
EXPOSE 80

# Start Nginx to serve the app
CMD ["nginx", "-g", "daemon off;"]
