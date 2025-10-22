#!/bin/bash

# Cloudflare DNS Setup Script for macOS

echo "Cloudflare 1.1.1.1 DNS Setup"
echo "============================"
echo ""
echo "Choose DNS configuration:"
echo "1) Standard 1.1.1.1 (Privacy + Speed)"
echo "2) 1.1.1.2 (Block Malware)"
echo "3) 1.1.1.3 (Block Malware + Adult Content)"
echo "4) Show current DNS settings"
echo "5) Reset to automatic (DHCP)"
echo ""

read -p "Enter choice (1-5): " choice

# Get network interface
interface=$(networksetup -listallnetworkservices | grep -E "Wi-Fi|Ethernet" | head -1)

if [ -z "$interface" ]; then
    echo "No network interface found"
    exit 1
fi

echo "Using interface: $interface"

case $choice in
    1)
        echo "Setting up standard 1.1.1.1..."
        sudo networksetup -setdnsservers "$interface" 1.1.1.1 1.0.0.1
        echo "DNS set to: 1.1.1.1, 1.0.0.1"
        ;;
    2)
        echo "Setting up 1.1.1.2 (Block Malware)..."
        sudo networksetup -setdnsservers "$interface" 1.1.1.2 1.0.0.2
        echo "DNS set to: 1.1.1.2, 1.0.0.2 (Malware blocking enabled)"
        ;;
    3)
        echo "Setting up 1.1.1.3 (Block Malware + Adult Content)..."
        sudo networksetup -setdnsservers "$interface" 1.1.1.3 1.0.0.3
        echo "DNS set to: 1.1.1.3, 1.0.0.3 (Malware + Adult content blocking enabled)"
        ;;
    4)
        echo "Current DNS servers:"
        networksetup -getdnsservers "$interface"
        ;;
    5)
        echo "Resetting to automatic DNS..."
        sudo networksetup -setdnsservers "$interface" empty
        echo "DNS reset to automatic (DHCP)"
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

if [ "$choice" -ge 1 ] && [ "$choice" -le 3 ]; then
    echo ""
    echo "Testing DNS resolution..."
    dig @1.1.1.1 cloudflare.com +short

    echo ""
    echo "Current DNS servers:"
    networksetup -getdnsservers "$interface"

    echo ""
    echo "DNS setup complete!"
    echo ""
    echo "Test your configuration:"
    echo "- Malware test: https://malware.testcategory.com/"
    echo "- Adult content test: https://nudity.testcategory.com/"
fi