#!/bin/bash

# Fix Magic Keyboard Bluetooth Issues
# For Touch ID keyboard MMMR3LL/A and standard keyboards

echo "🔧 Magic Keyboard Bluetooth Fix Tool"
echo "====================================="
echo ""

# Function to reset Bluetooth
reset_bluetooth() {
    echo "🔄 Resetting Bluetooth system..."

    # Kill Bluetooth daemon
    sudo pkill bluetoothd

    # Wait for restart
    sleep 2

    # Restart Bluetooth
    sudo launchctl load /System/Library/LaunchDaemons/com.apple.bluetoothd.plist 2>/dev/null

    echo "✅ Bluetooth reset complete"
    echo ""
}

# Function to list current keyboards
list_keyboards() {
    echo "📱 Current Bluetooth keyboards:"
    echo ""
    system_profiler SPBluetoothDataType 2>/dev/null | grep -A 5 "Magic Keyboard" | grep -E "Address:|Product ID:|Firmware"
    echo ""
}

# Function to forget keyboard
forget_keyboard() {
    echo "🗑️  To forget a keyboard:"
    echo "1. Open System Settings → Bluetooth"
    echo "2. Find the keyboard in the list"
    echo "3. Click the (i) button next to it"
    echo "4. Click 'Forget This Device'"
    echo ""
}

# Function for Touch ID keyboard pairing
pair_touchid_keyboard() {
    echo "🔐 Touch ID Keyboard (MMMR3LL/A) Pairing Instructions:"
    echo "======================================================="
    echo ""
    echo "Method 1: Cable Pairing (MOST RELIABLE)"
    echo "-----------------------------------------"
    echo "1. Turn OFF the keyboard using power switch"
    echo "2. Connect keyboard with USB-C cable to your Mac"
    echo "3. Wait exactly 60 seconds (important!)"
    echo "4. Turn ON the keyboard while still connected"
    echo "5. Wait 10 seconds"
    echo "6. Disconnect the USB-C cable"
    echo "7. Keyboard should now work via Bluetooth"
    echo ""
    echo "Method 2: Hold Power Button Trick"
    echo "----------------------------------"
    echo "1. Turn keyboard OFF"
    echo "2. Forget the device in Bluetooth settings"
    echo "3. Turn keyboard ON"
    echo "4. HOLD the power button continuously"
    echo "5. Go to System Settings → Bluetooth"
    echo "6. Click on the keyboard when it appears"
    echo "7. KEEP HOLDING power button while typing pairing code"
    echo "8. Only release after 'Connected' appears"
    echo ""
}

# Function for standard keyboard switch fix
fix_power_switch() {
    echo "🔌 Magic Keyboard Power Switch Fix (A1843):"
    echo "============================================"
    echo ""
    echo "The '90% Off' Trick:"
    echo "--------------------"
    echo "1. Slide switch all the way to OFF position (left)"
    echo "2. Then slide it back RIGHT just a tiny bit (10%)"
    echo "3. This '90% off' position often works when 100% doesn't"
    echo ""
    echo "Contact Cleaner Method:"
    echo "-----------------------"
    echo "1. Get electronic contact cleaner spray"
    echo "2. Spray into switch area (small amount)"
    echo "3. Toggle switch back and forth 20 times"
    echo "4. Let dry for 5 minutes"
    echo "5. Test the switch"
    echo ""
    echo "Check if Actually Off:"
    echo "----------------------"
    echo "- No green light visible in switch"
    echo "- Bluetooth shows 'Not Connected'"
    echo "- Keys don't type anything"
    echo ""
}

# Main menu
main_menu() {
    echo "Choose an option:"
    echo ""
    echo "1) Reset Bluetooth system (requires password)"
    echo "2) List current keyboards"
    echo "3) Fix Touch ID keyboard (MMMR3LL/A) Bluetooth"
    echo "4) Fix power switch on standard keyboard (A1843)"
    echo "5) Instructions to forget a keyboard"
    echo "6) Exit"
    echo ""
    read -p "Enter choice (1-6): " choice

    case $choice in
        1)
            reset_bluetooth
            list_keyboards
            ;;
        2)
            list_keyboards
            ;;
        3)
            pair_touchid_keyboard
            ;;
        4)
            fix_power_switch
            ;;
        5)
            forget_keyboard
            ;;
        6)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "Invalid choice"
            ;;
    esac

    echo ""
    read -p "Press Enter to continue..."
    clear
    main_menu
}

# Check if running as root when needed
check_sudo() {
    if [[ "$1" == "1" ]] && [[ $EUID -ne 0 ]]; then
        echo "Option 1 requires sudo. Run: sudo $0"
        exit 1
    fi
}

# Start
clear
main_menu