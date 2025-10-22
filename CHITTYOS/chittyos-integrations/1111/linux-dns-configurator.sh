#!/bin/bash

# Linux Cloudflare DNS Configurator
# Supports multiple configuration methods: resolv.conf, systemd-resolved, NetworkManager

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# DNS Configuration Options
DNS_STANDARD_V4=("1.1.1.1" "1.0.0.1")
DNS_STANDARD_V6=("2606:4700:4700::1111" "2606:4700:4700::1001")

DNS_MALWARE_V4=("1.1.1.2" "1.0.0.2")
DNS_MALWARE_V6=("2606:4700:4700::1112" "2606:4700:4700::1002")

DNS_FAMILY_V4=("1.1.1.3" "1.0.0.3")
DNS_FAMILY_V6=("2606:4700:4700::1113" "2606:4700:4700::1003")

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${YELLOW}This script requires sudo privileges. Requesting...${NC}"
        exec sudo "$0" "$@"
    fi
}

# Detect system configuration method
detect_system() {
    if systemctl is-active --quiet systemd-resolved; then
        echo "systemd-resolved"
    elif [ -f /etc/NetworkManager/NetworkManager.conf ]; then
        echo "networkmanager"
    else
        echo "resolv.conf"
    fi
}

# Backup current DNS settings
backup_dns() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_dir="$HOME/.dns_backups"
    mkdir -p "$backup_dir"

    if [ -f /etc/resolv.conf ]; then
        cp /etc/resolv.conf "$backup_dir/resolv.conf.$timestamp"
        echo -e "${GREEN}✓ Backed up /etc/resolv.conf to $backup_dir/resolv.conf.$timestamp${NC}"
    fi

    if [ -f /etc/systemd/resolved.conf ]; then
        cp /etc/systemd/resolved.conf "$backup_dir/resolved.conf.$timestamp"
        echo -e "${GREEN}✓ Backed up systemd-resolved config${NC}"
    fi
}

# Configure using resolv.conf
configure_resolv_conf() {
    local dns_v4=("$@")

    echo -e "${YELLOW}Configuring /etc/resolv.conf...${NC}"

    # Check if resolv.conf is managed
    if [ -L /etc/resolv.conf ]; then
        echo -e "${YELLOW}Warning: /etc/resolv.conf is a symlink (possibly managed by systemd-resolved or NetworkManager)${NC}"
        read -p "Continue anyway? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 1
        fi
        # Remove symlink and create regular file
        rm /etc/resolv.conf
    fi

    # Write new configuration
    {
        echo "# Cloudflare DNS Configuration"
        echo "# Generated on $(date)"
        for dns in "${dns_v4[@]}"; do
            echo "nameserver $dns"
        done
    } > /etc/resolv.conf

    # Make immutable to prevent DHCP overwrites (optional)
    read -p "Make resolv.conf immutable to prevent DHCP overwrites? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        chattr +i /etc/resolv.conf
        echo -e "${GREEN}✓ resolv.conf is now immutable${NC}"
    fi

    echo -e "${GREEN}✓ DNS configured via resolv.conf${NC}"
}

# Configure using systemd-resolved
configure_systemd_resolved() {
    local dns_v4=("$@")
    local config_file="/etc/systemd/resolved.conf"

    echo -e "${YELLOW}Configuring systemd-resolved...${NC}"

    # Create configuration
    cp "$config_file" "$config_file.bak"

    # Build DNS string
    local dns_string=""
    for dns in "${dns_v4[@]}"; do
        dns_string+="$dns "
    done

    # Update configuration
    sed -i '/^DNS=/d' "$config_file"
    sed -i '/^FallbackDNS=/d' "$config_file"
    sed -i '/^DNSOverTLS=/d' "$config_file"

    # Add new configuration
    sed -i "/\[Resolve\]/a DNS=$dns_string" "$config_file"

    # Ask about DNS over TLS
    read -p "Enable DNS over TLS? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sed -i "/\[Resolve\]/a DNSOverTLS=yes" "$config_file"
        sed -i "s/DNS=$dns_string/DNS=${dns_v4[0]}#one.one.one.one ${dns_v4[1]}#one.one.one.one/" "$config_file"
        echo -e "${GREEN}✓ DNS over TLS enabled${NC}"
    fi

    # Restart service
    systemctl restart systemd-resolved

    # Update resolv.conf symlink if needed
    if [ ! -L /etc/resolv.conf ] || [ "$(readlink -f /etc/resolv.conf)" != "/run/systemd/resolve/stub-resolv.conf" ]; then
        ln -sf /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
    fi

    echo -e "${GREEN}✓ DNS configured via systemd-resolved${NC}"
}

# Configure using NetworkManager
configure_networkmanager() {
    local dns_v4=("$@")

    echo -e "${YELLOW}Configuring NetworkManager...${NC}"

    # Get active connection
    local connection=$(nmcli -t -f NAME,TYPE,DEVICE con show --active | head -1 | cut -d: -f1)

    if [ -z "$connection" ]; then
        echo -e "${RED}No active connection found${NC}"
        return 1
    fi

    echo -e "${CYAN}Active connection: $connection${NC}"

    # Set DNS servers
    local dns_string=$(IFS=','; echo "${dns_v4[*]}")
    nmcli con mod "$connection" ipv4.dns "$dns_string"
    nmcli con mod "$connection" ipv4.ignore-auto-dns yes

    # Apply changes
    nmcli con up "$connection"

    echo -e "${GREEN}✓ DNS configured via NetworkManager${NC}"
}

# Test DNS configuration
test_dns() {
    echo -e "\n${BLUE}Testing DNS Configuration...${NC}"

    # Test resolution
    if command -v dig &> /dev/null; then
        echo -e "${CYAN}Testing with dig...${NC}"
        dig @1.1.1.1 cloudflare.com +short
        response_time=$(dig @1.1.1.1 cloudflare.com +stats | grep "Query time:" | awk '{print $4}')
        echo -e "${GREEN}✓ Response time: ${response_time}ms${NC}"
    elif command -v nslookup &> /dev/null; then
        echo -e "${CYAN}Testing with nslookup...${NC}"
        nslookup cloudflare.com 1.1.1.1
    elif command -v host &> /dev/null; then
        echo -e "${CYAN}Testing with host...${NC}"
        host cloudflare.com 1.1.1.1
    else
        echo -e "${YELLOW}No DNS testing tools found (dig/nslookup/host)${NC}"
    fi

    # Check current DNS servers
    echo -e "\n${CYAN}Current DNS servers:${NC}"
    if command -v resolvectl &> /dev/null; then
        resolvectl status | grep "DNS Servers"
    else
        cat /etc/resolv.conf | grep nameserver
    fi
}

# Main menu
show_menu() {
    clear
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}         Cloudflare DNS Configurator for Linux${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}System detected: $(detect_system)${NC}"
    echo ""
    echo -e "${YELLOW}DNS Options:${NC}"
    echo "  1) Standard 1.1.1.1 - Privacy & Speed"
    echo "     IPv4: ${DNS_STANDARD_V4[*]}"
    echo "     IPv6: ${DNS_STANDARD_V6[0]}, ${DNS_STANDARD_V6[1]}"
    echo ""
    echo "  2) Block Malware - 1.1.1.2"
    echo "     IPv4: ${DNS_MALWARE_V4[*]}"
    echo "     IPv6: ${DNS_MALWARE_V6[0]}, ${DNS_MALWARE_V6[1]}"
    echo ""
    echo "  3) Block Malware + Adult Content - 1.1.1.3"
    echo "     IPv4: ${DNS_FAMILY_V4[*]}"
    echo "     IPv6: ${DNS_FAMILY_V6[0]}, ${DNS_FAMILY_V6[1]}"
    echo ""
    echo -e "${YELLOW}Configuration Methods:${NC}"
    echo "  4) Auto-detect and configure"
    echo "  5) Force resolv.conf method"
    echo "  6) Force systemd-resolved method"
    echo "  7) Force NetworkManager method"
    echo ""
    echo -e "${YELLOW}Other Options:${NC}"
    echo "  8) Show current DNS configuration"
    echo "  9) Restore from backup"
    echo "  0) Exit"
    echo ""
}

# Get DNS choice
get_dns_choice() {
    local choice=$1
    case $choice in
        1|4|5|6|7)
            echo "${DNS_STANDARD_V4[@]}"
            ;;
        2)
            echo "${DNS_MALWARE_V4[@]}"
            ;;
        3)
            echo "${DNS_FAMILY_V4[@]}"
            ;;
    esac
}

# Main execution
main() {
    check_root

    while true; do
        show_menu
        read -p "Enter your choice (0-9): " choice

        case $choice in
            1|2|3)
                backup_dns
                dns_servers=($(get_dns_choice $choice))
                method=$(detect_system)

                case $method in
                    "systemd-resolved")
                        configure_systemd_resolved "${dns_servers[@]}"
                        ;;
                    "networkmanager")
                        configure_networkmanager "${dns_servers[@]}"
                        ;;
                    *)
                        configure_resolv_conf "${dns_servers[@]}"
                        ;;
                esac

                test_dns

                if [ "$choice" == "2" ] || [ "$choice" == "3" ]; then
                    echo -e "\n${YELLOW}Test URLs:${NC}"
                    echo "• Malware test: https://malware.testcategory.com/"
                fi
                if [ "$choice" == "3" ]; then
                    echo "• Adult content test: https://nudity.testcategory.com/"
                fi
                ;;

            4)
                backup_dns
                dns_servers=($(get_dns_choice 1))
                method=$(detect_system)

                case $method in
                    "systemd-resolved")
                        configure_systemd_resolved "${dns_servers[@]}"
                        ;;
                    "networkmanager")
                        configure_networkmanager "${dns_servers[@]}"
                        ;;
                    *)
                        configure_resolv_conf "${dns_servers[@]}"
                        ;;
                esac

                test_dns
                ;;

            5)
                backup_dns
                read -p "Select DNS option (1=Standard, 2=Malware, 3=Family): " dns_opt
                dns_servers=($(get_dns_choice $dns_opt))
                configure_resolv_conf "${dns_servers[@]}"
                test_dns
                ;;

            6)
                if ! systemctl is-active --quiet systemd-resolved; then
                    echo -e "${YELLOW}systemd-resolved is not active. Starting...${NC}"
                    systemctl enable --now systemd-resolved
                fi
                backup_dns
                read -p "Select DNS option (1=Standard, 2=Malware, 3=Family): " dns_opt
                dns_servers=($(get_dns_choice $dns_opt))
                configure_systemd_resolved "${dns_servers[@]}"
                test_dns
                ;;

            7)
                if ! command -v nmcli &> /dev/null; then
                    echo -e "${RED}NetworkManager is not installed${NC}"
                    continue
                fi
                backup_dns
                read -p "Select DNS option (1=Standard, 2=Malware, 3=Family): " dns_opt
                dns_servers=($(get_dns_choice $dns_opt))
                configure_networkmanager "${dns_servers[@]}"
                test_dns
                ;;

            8)
                echo -e "\n${BLUE}Current DNS Configuration:${NC}"
                echo -e "\n${CYAN}/etc/resolv.conf:${NC}"
                cat /etc/resolv.conf | grep -E "^nameserver|^#"

                if systemctl is-active --quiet systemd-resolved; then
                    echo -e "\n${CYAN}systemd-resolved status:${NC}"
                    resolvectl status 2>/dev/null || systemd-resolve --status
                fi

                if command -v nmcli &> /dev/null; then
                    echo -e "\n${CYAN}NetworkManager DNS:${NC}"
                    nmcli dev show | grep DNS
                fi
                ;;

            9)
                echo -e "\n${BLUE}Available backups:${NC}"
                ls -la "$HOME/.dns_backups/" 2>/dev/null
                echo ""
                read -p "Enter backup filename to restore: " backup_file
                if [ -f "$HOME/.dns_backups/$backup_file" ]; then
                    if [[ $backup_file == resolv.conf.* ]]; then
                        cp "$HOME/.dns_backups/$backup_file" /etc/resolv.conf
                        echo -e "${GREEN}✓ Restored /etc/resolv.conf${NC}"
                    elif [[ $backup_file == resolved.conf.* ]]; then
                        cp "$HOME/.dns_backups/$backup_file" /etc/systemd/resolved.conf
                        systemctl restart systemd-resolved
                        echo -e "${GREEN}✓ Restored systemd-resolved configuration${NC}"
                    fi
                else
                    echo -e "${RED}Backup file not found${NC}"
                fi
                ;;

            0)
                echo -e "${GREEN}Goodbye!${NC}"
                exit 0
                ;;

            *)
                echo -e "${RED}Invalid option${NC}"
                ;;
        esac

        echo ""
        read -p "Press Enter to continue..."
    done
}

# Run main function
main "$@"