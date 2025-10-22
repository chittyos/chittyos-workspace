#!/bin/bash

echo "🔄 Full Bluetooth Reset for Touch ID Keyboard"
echo "=============================================="
echo ""
echo "This will:"
echo "1. Kill Bluetooth daemon"
echo "2. Remove Bluetooth preference files"
echo "3. Restart Bluetooth"
echo ""
echo "You'll need to re-pair ALL Bluetooth devices after this."
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Resetting Bluetooth..."

    # Kill Bluetooth
    sudo pkill bluetoothd

    # Remove Bluetooth preferences (backup first)
    mkdir -p ~/Desktop/bluetooth-backup
    cp ~/Library/Preferences/com.apple.Bluetooth.plist ~/Desktop/bluetooth-backup/ 2>/dev/null

    # Remove the preferences
    sudo rm -f ~/Library/Preferences/com.apple.Bluetooth.plist
    sudo rm -f /Library/Preferences/com.apple.Bluetooth.plist

    # Reset Bluetooth module
    sudo defaults write /Library/Preferences/com.apple.Bluetooth.plist ControllerPowerState 0
    sudo defaults write /Library/Preferences/com.apple.Bluetooth.plist ControllerPowerState 1

    # Restart Bluetooth
    sudo killall blued 2>/dev/null
    sudo launchctl stop com.apple.bluetoothd
    sudo launchctl start com.apple.bluetoothd

    echo "✅ Bluetooth reset complete!"
    echo ""
    echo "Now try pairing the Touch ID keyboard:"
    echo "1. Turn keyboard ON"
    echo "2. HOLD POWER BUTTON continuously"
    echo "3. Open Bluetooth settings"
    echo "4. Click keyboard when it appears"
    echo "5. Keep holding power while entering code"
    echo "6. Only release after connected"
else
    echo "Cancelled."
fi