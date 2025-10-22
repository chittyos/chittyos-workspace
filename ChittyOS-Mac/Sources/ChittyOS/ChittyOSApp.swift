import SwiftUI
import Combine
import Network
import UserNotifications

@main
struct ChittyOSApp: App {
    @StateObject private var appState = ChittyOSAppState()
    @StateObject private var cloudSync = ChittyCloudSync()
    @StateObject private var menuBarManager = MenuBarManager()

    var body: some Scene {
        // Hidden main window (menu bar only)
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(cloudSync)
                .frame(width: 0, height: 0)
                .hidden()
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)

        // Menu bar extra
        MenuBarExtra("ChittyOS", systemImage: "shield.checkered") {
            ChittyMenuBarView()
                .environmentObject(appState)
                .environmentObject(cloudSync)
        }
        .menuBarExtraStyle(.window)
    }
}

// MARK: - App State Management
class ChittyOSAppState: ObservableObject {
    @Published var isOnline = false
    @Published var currentUser: ChittyUser?
    @Published var trustLevel: Double = 0.0
    @Published var activeProjects: [ChittyProject] = []
    @Published var notifications: [ChittyNotification] = []
    @Published var systemStatus: SystemStatus = .unknown

    private var cancellables = Set<AnyCancellable>()

    init() {
        setupNetworkMonitoring()
        requestNotificationPermissions()
    }

    private func setupNetworkMonitoring() {
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isOnline = path.status == .satisfied
            }
        }
        let queue = DispatchQueue(label: "NetworkMonitor")
        monitor.start(queue: queue)
    }

    private func requestNotificationPermissions() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if granted {
                print("✅ Notification permissions granted")
            }
        }
    }
}

// MARK: - Cloud Sync Manager
class ChittyCloudSync: ObservableObject {
    @Published var syncStatus: SyncStatus = .idle
    @Published var lastSyncTime: Date?
    @Published var pendingUploads: Int = 0
    @Published var conflictCount: Int = 0

    private let baseURL = "https://router.chitty.cc"
    private var authToken: String?
    private var cancellables = Set<AnyCancellable>()

    enum SyncStatus {
        case idle, syncing, error(String), success
    }

    init() {
        startPeriodicSync()
    }

    func authenticate(with token: String) {
        self.authToken = token
        syncNow()
    }

    func syncNow() {
        guard let token = authToken else { return }

        syncStatus = .syncing

        // Sync with cloud services
        Task {
            do {
                try await performCloudSync(token: token)
                await MainActor.run {
                    self.syncStatus = .success
                    self.lastSyncTime = Date()
                }
            } catch {
                await MainActor.run {
                    self.syncStatus = .error(error.localizedDescription)
                }
            }
        }
    }

    private func performCloudSync(token: String) async throws {
        // Sync with multiple ChittyOS services
        try await withThrowingTaskGroup(of: Void.self) { group in

            // Sync projects with ChittyChat
            group.addTask {
                try await self.syncProjects(token: token)
            }

            // Sync trust score with ChittyTrust
            group.addTask {
                try await self.syncTrustLevel(token: token)
            }

            // Sync notifications
            group.addTask {
                try await self.syncNotifications(token: token)
            }

            try await group.waitForAll()
        }
    }

    private func syncProjects(token: String) async throws {
        var request = URLRequest(url: URL(string: "\(baseURL)/api/projects")!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, _) = try await URLSession.shared.data(for: request)
        let projects = try JSONDecoder().decode([ChittyProject].self, from: data)

        await MainActor.run {
            // Update app state with projects
        }
    }

    private func syncTrustLevel(token: String) async throws {
        var request = URLRequest(url: URL(string: "https://trust.chitty.cc/api/score")!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, _) = try await URLSession.shared.data(for: request)
        let trustData = try JSONDecoder().decode(TrustScore.self, from: data)

        await MainActor.run {
            // Update trust level
        }
    }

    private func syncNotifications(token: String) async throws {
        // Sync with notification service
    }

    private func startPeriodicSync() {
        Timer.publish(every: 60, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                if self?.authToken != nil {
                    self?.syncNow()
                }
            }
            .store(in: &cancellables)
    }
}

// MARK: - Menu Bar Manager
class MenuBarManager: ObservableObject {
    @Published var quickActions: [QuickAction] = []

    init() {
        setupQuickActions()
    }

    private func setupQuickActions() {
        quickActions = [
            QuickAction(title: "New ChittyID", icon: "plus.circle", action: createNewChittyID),
            QuickAction(title: "Sync Now", icon: "arrow.clockwise", action: syncNow),
            QuickAction(title: "View Projects", icon: "folder", action: openProjects),
            QuickAction(title: "Check Trust", icon: "shield", action: checkTrust)
        ]
    }

    private func createNewChittyID() {
        // Request ChittyID from cloud
        Task {
            await ChittyIDService.shared.requestID(type: .document)
        }
    }

    private func syncNow() {
        // Trigger immediate sync
    }

    private func openProjects() {
        // Open projects window
    }

    private func checkTrust() {
        // Show trust level
    }
}

// MARK: - Menu Bar View
struct ChittyMenuBarView: View {
    @EnvironmentObject var appState: ChittyOSAppState
    @EnvironmentObject var cloudSync: ChittyCloudSync

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Image(systemName: "shield.checkered")
                    .foregroundColor(.blue)
                Text("ChittyOS")
                    .font(.headline)
                Spacer()
                Circle()
                    .fill(appState.isOnline ? .green : .red)
                    .frame(width: 8, height: 8)
            }
            .padding(.horizontal)

            Divider()

            // Trust Level
            HStack {
                Text("Trust Level")
                Spacer()
                TrustLevelView(level: appState.trustLevel)
            }
            .padding(.horizontal)

            // Sync Status
            HStack {
                Text("Sync Status")
                Spacer()
                SyncStatusView(status: cloudSync.syncStatus)
            }
            .padding(.horizontal)

            Divider()

            // Quick Actions
            VStack(alignment: .leading, spacing: 4) {
                Text("Quick Actions")
                    .font(.caption)
                    .foregroundColor(.secondary)

                QuickActionsView()
            }
            .padding(.horizontal)

            Divider()

            // Recent Activity
            if !appState.notifications.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Recent Activity")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    ForEach(appState.notifications.prefix(3), id: \.id) { notification in
                        NotificationRowView(notification: notification)
                    }
                }
                .padding(.horizontal)

                Divider()
            }

            // Footer Actions
            HStack {
                Button("Settings") {
                    openSettings()
                }
                .buttonStyle(.plain)

                Spacer()

                Button("Quit") {
                    NSApplication.shared.terminate(nil)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal)
        }
        .frame(width: 280)
        .padding(.vertical, 8)
    }

    private func openSettings() {
        // Open settings window
    }
}

// MARK: - Supporting Views
struct TrustLevelView: View {
    let level: Double

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<5) { i in
                Image(systemName: i < Int(level * 5) ? "star.fill" : "star")
                    .foregroundColor(.yellow)
                    .font(.caption)
            }
            Text("\(Int(level * 100))%")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

struct SyncStatusView: View {
    let status: ChittyCloudSync.SyncStatus

    var body: some View {
        HStack {
            switch status {
            case .idle:
                Image(systemName: "pause.circle")
                    .foregroundColor(.secondary)
                Text("Idle")
            case .syncing:
                ProgressView()
                    .scaleEffect(0.5)
                Text("Syncing...")
            case .success:
                Image(systemName: "checkmark.circle")
                    .foregroundColor(.green)
                Text("Up to date")
            case .error(let message):
                Image(systemName: "exclamationmark.circle")
                    .foregroundColor(.red)
                Text("Error")
            }
        }
        .font(.caption)
    }
}

struct QuickActionsView: View {
    var body: some View {
        VStack(spacing: 2) {
            QuickActionButton(title: "New ChittyID", icon: "plus.circle") {
                // Create new ID
            }

            QuickActionButton(title: "Sync Now", icon: "arrow.clockwise") {
                // Sync now
            }

            QuickActionButton(title: "View Projects", icon: "folder") {
                // Open projects
            }

            QuickActionButton(title: "Check Evidence", icon: "doc.text") {
                // Check evidence
            }
        }
    }
}

struct QuickActionButton: View {
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                    .frame(width: 16)
                Text(title)
                    .font(.caption)
                Spacer()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.vertical, 2)
    }
}

struct NotificationRowView: View {
    let notification: ChittyNotification

    var body: some View {
        HStack {
            Image(systemName: notification.icon)
                .foregroundColor(notification.color)
                .frame(width: 16)

            VStack(alignment: .leading, spacing: 1) {
                Text(notification.title)
                    .font(.caption)
                    .lineLimit(1)
                Text(notification.subtitle)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            Text(notification.timeAgo)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Content View (Hidden)
struct ContentView: View {
    var body: some View {
        EmptyView()
    }
}

// MARK: - Data Models
struct ChittyUser: Codable {
    let id: String
    let name: String
    let email: String
    let trustLevel: Double
}

struct ChittyProject: Codable, Identifiable {
    let id: String
    let name: String
    let status: String
    let lastModified: Date
}

struct ChittyNotification: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let icon: String
    let color: Color
    let timeAgo: String
    let timestamp: Date
}

struct TrustScore: Codable {
    let overall: Double
    let temporal: Double
    let contextual: Double
    let behavioral: Double
    let network: Double
    let economic: Double
    let reputational: Double
}

struct QuickAction {
    let title: String
    let icon: String
    let action: () -> Void
}

enum SystemStatus {
    case unknown, healthy, warning, error
}