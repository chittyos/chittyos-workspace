# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

founder-ops is the infrastructure operations repository for the ChittyOS ecosystem. It contains scripts, configurations, and resources for provisioning and managing servers that host ChittyOS services.

## Current Contents

- **enable-ssh.sh** - Enables SSH on macOS servers (run on target machine)
- **ubuntu-22.04.5-live-server-amd64.iso** - Ubuntu Server image for provisioning Linux servers

## Target Infrastructure

- **chittyserv-1** - macOS server accessible at `chittyserv-1.local`
- Linux servers provisioned with Ubuntu 22.04 LTS

## Related Context

This repository operates within the broader ChittyOS ecosystem. Gateway services and core packages are in `/Volumes/chitty/workspace/`. Service repositories are organized under `/Volumes/chitty/github.com/` by organization (CHITTYFOUNDATION, CHITTYOS, etc.).
