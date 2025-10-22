#!/bin/bash

# macOS Cloudflare DNS Configurator
# Interactive script for setting up 1.1.1.1 DNS via System Settings

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

clear
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}        Cloudflare 1.1.1.1 DNS Setup for macOS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Function to save current DNS settings
save_current_dns() {
    local interface=$1
    local current_dns=$(networksetup -getdnsservers "$interface" 2>/dev/null)

    if [ "$current_dns" != "There aren't any DNS Servers set on $interface." ]; then
        timestamp=$(date +"%Y%m%d_%H%M%S")
        backup_file="$HOME/dns_backup_${timestamp}.txt"
        echo "Interface: $interface" > "$backup_file"
        echo "Date: $(date)" >> "$backup_file"
        echo "DNS Servers:" >> "$backup_file"
        echo "$current_dns" >> "$backup_file"
        echo -e "${GREEN}✓ Current DNS settings backed up to: $backup_file${NC}"
    else
        echo -e "${YELLOW}ℹ No custom DNS servers currently configured${NC}"
    fi
}

# Function to test DNS
test_dns() {
    echo -e "\n${BLUE}Testing DNS resolution...${NC}"
    if dig @1.1.1.1 cloudflare.com +short > /dev/null 2>&1; then
        echo -e "${GREEN}✓ DNS resolution working${NC}"
        response_time=$(dig @1.1.1.1 cloudflare.com +stats | grep "Query time:" | awk '{print $4}')
        echo -e "${GREEN}✓ Response time: ${response_time}ms${NC}"
    else
        echo -e "${RED}✗ DNS resolution failed${NC}"
    fi
}

# Get all network interfaces
echo -e "${YELLOW}Detecting network interfaces...${NC}"
interfaces=$(networksetup -listallnetworkservices | grep -v "An asterisk")

echo -e "\n${BLUE}Available network interfaces:${NC}"
i=1
interface_array=()
while IFS= read -r line; do
    interface_array+=("$line")
    echo "  $i) $line"
    ((i++))
done <<< "$interfaces"

echo ""
read -p "Select interface number (or press Enter for all): " interface_choice

if [ -z "$interface_choice" ]; then
    selected_interfaces=("${interface_array[@]}")
    echo -e "${GREEN}Configuring all interfaces${NC}"
else
    if [ "$interface_choice" -ge 1 ] && [ "$interface_choice" -le "${#interface_array[@]}" ]; then
        selected_interfaces=("${interface_array[$((interface_choice-1))]}")
        echo -e "${GREEN}Selected: ${selected_interfaces[0]}${NC}"
    else
        echo -e "${RED}Invalid selection${NC}"
        exit 1
    fi
fi

# DNS options
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}DNS Configuration Options:${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  1) Standard 1.1.1.1 - Privacy & Speed"
echo "     • IPv4: 1.1.1.1, 1.0.0.1"
echo "     • IPv6: 2606:4700:4700::1111, 2606:4700:4700::1001"
echo ""
echo "  2) 1.1.1.2 - Block Malware"
echo "     • IPv4: 1.1.1.2, 1.0.0.2"
echo "     • IPv6: 2606:4700:4700::1112, 2606:4700:4700::1002"
echo ""
echo "  3) 1.1.1.3 - Block Malware + Adult Content"
echo "     • IPv4: 1.1.1.3, 1.0.0.3"
echo "     • IPv6: 2606:4700:4700::1113, 2606:4700:4700::1003"
echo ""
echo "  4) Show current DNS settings"
echo "  5) Open System Settings (manual configuration)"
echo "  6) Reset to automatic (DHCP)"
echo ""

read -p "Enter your choice (1-6): " dns_choice

case $dns_choice in
    1)
        dns_primary="1.1.1.1"
        dns_secondary="1.0.0.1"
        dns_primary_v6="2606:4700:4700::1111"
        dns_secondary_v6="2606:4700:4700::1001"
        config_name="Standard 1.1.1.1"
        ;;
    2)
        dns_primary="1.1.1.2"
        dns_secondary="1.0.0.2"
        dns_primary_v6="2606:4700:4700::1112"
        dns_secondary_v6="2606:4700:4700::1002"
        config_name="1.1.1.2 (Malware Blocking)"
        ;;
    3)
        dns_primary="1.1.1.3"
        dns_secondary="1.0.0.3"
        dns_primary_v6="2606:4700:4700::1113"
        dns_secondary_v6="2606:4700:4700::1003"
        config_name="1.1.1.3 (Malware + Adult Content Blocking)"
        ;;
    4)
        echo -e "\n${BLUE}Current DNS Configuration:${NC}"
        for interface in "${selected_interfaces[@]}"; do
            echo -e "\n${YELLOW}$interface:${NC}"
            networksetup -getdnsservers "$interface"
        done
        exit 0
        ;;
    5)
        echo -e "\n${BLUE}Opening System Settings...${NC}"
        open "x-apple.systempreferences:com.apple.Network-Settings.extension"
        echo -e "\n${YELLOW}Manual Configuration Instructions:${NC}"
        echo "1. Select your network interface"
        echo "2. Click 'Details...'"
        echo "3. Go to 'DNS' tab"
        echo "4. Click '+' to add DNS servers"
        echo ""
        echo "Standard 1.1.1.1:"
        echo "  • 1.1.1.1"
        echo "  • 1.0.0.1"
        echo ""
        echo "Block Malware (1.1.1.2):"
        echo "  • 1.1.1.2"
        echo "  • 1.0.0.2"
        echo ""
        echo "Block Malware + Adult Content (1.1.1.3):"
        echo "  • 1.1.1.3"
        echo "  • 1.0.0.3"
        exit 0
        ;;
    6)
        echo -e "\n${YELLOW}Resetting to automatic DNS...${NC}"
        for interface in "${selected_interfaces[@]}"; do
            echo -e "Resetting $interface..."
            sudo networksetup -setdnsservers "$interface" empty
            echo -e "${GREEN}✓ $interface reset to automatic (DHCP)${NC}"
        done
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Apply DNS settings
echo -e "\n${YELLOW}Applying DNS configuration: $config_name${NC}"

for interface in "${selected_interfaces[@]}"; do
    echo -e "\n${BLUE}Configuring $interface...${NC}"

    # Backup current settings
    save_current_dns "$interface"

    # Set IPv4 DNS
    echo -e "Setting IPv4 DNS servers..."
    sudo networksetup -setdnsservers "$interface" "$dns_primary" "$dns_secondary"

    # Optionally set IPv6 DNS
    read -p "Configure IPv6 DNS as well? (y/n): " ipv6_choice
    if [ "$ipv6_choice" = "y" ] || [ "$ipv6_choice" = "Y" ]; then
        echo -e "Setting IPv6 DNS servers..."
        sudo networksetup -setdnsservers "$interface" "$dns_primary" "$dns_secondary" "$dns_primary_v6" "$dns_secondary_v6"
    fi

    echo -e "${GREEN}✓ $interface configured${NC}"
done

# Flush DNS cache
echo -e "\n${YELLOW}Flushing DNS cache...${NC}"
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder 2>/dev/null
echo -e "${GREEN}✓ DNS cache flushed${NC}"

# Test configuration
test_dns

# Show final configuration
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Configuration Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

for interface in "${selected_interfaces[@]}"; do
    echo -e "\n${YELLOW}$interface DNS servers:${NC}"
    networksetup -getdnsservers "$interface"
done

# Test URLs
echo -e "\n${YELLOW}Test your configuration:${NC}"
if [ "$dns_choice" = "2" ] || [ "$dns_choice" = "3" ]; then
    echo "• Malware blocking test: https://malware.testcategory.com/"
    echo "  (This should be blocked)"
fi
if [ "$dns_choice" = "3" ]; then
    echo "• Adult content test: https://nudity.testcategory.com/"
    echo "  (This should be blocked)"
fi

echo -e "\n${YELLOW}Important Notes:${NC}"
echo "• Static DNS may prevent connection to captive portal Wi-Fi networks"
echo "• If you have connection issues, temporarily reset to automatic DNS"
echo "• Your DNS backup files are saved in your home directory"

echo -e "\n${BLUE}Report miscategorized domains:${NC}"
echo "https://radar.cloudflare.com/categorization-feedback"