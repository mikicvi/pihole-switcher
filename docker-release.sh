#!/bin/bash

# Define variables
IMAGE_NAME="pihole-switcher"
DOCKER_HUB_USER="mikicv"

echo "Building Docker images for both architectures..."

# Build for amd64
echo "Building amd64 image..."
docker build --platform=linux/amd64 -t "$DOCKER_HUB_USER/$IMAGE_NAME:x86_64" .

# Build for arm64
echo "Building arm64 image..."
docker build --platform=linux/arm64 -t "$DOCKER_HUB_USER/$IMAGE_NAME:arm64" .

echo "Pushing images to Docker Hub..."
docker push "$DOCKER_HUB_USER/$IMAGE_NAME:x86_64"
docker push "$DOCKER_HUB_USER/$IMAGE_NAME:arm64"

echo "Creating and pushing multi-arch manifest..."
docker manifest create --amend "$DOCKER_HUB_USER/$IMAGE_NAME:latest" \
    "$DOCKER_HUB_USER/$IMAGE_NAME:x86_64" \
    "$DOCKER_HUB_USER/$IMAGE_NAME:arm64"
docker manifest push "$DOCKER_HUB_USER/$IMAGE_NAME:latest"

echo "Done."
