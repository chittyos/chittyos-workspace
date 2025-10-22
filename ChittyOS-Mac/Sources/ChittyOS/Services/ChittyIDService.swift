import Foundation
import CryptoKit
import Network

// MARK: - ChittyID Service (Mac Native)
@MainActor
class ChittyIDService: ObservableObject {
    static let shared = ChittyIDService()

    @Published var recentIDs: [CloudChittyID] = []
    @Published var operationStatus: OperationStatus = .idle
    @Published var isOnline = true

    private let cloudAPI = ChittyCloudAPI()

    enum OperationStatus {
        case idle, processing, error(String), success
    }

    enum IDType {
        case person, document, project, evidence, asset
    }

    private init() {
        setupNetworkMonitoring()
        loadRecentCloudIDs()
    }

    // MARK: - ID Request (Cloud-Only Pattern)
    func requestID(type: IDType, metadata: [String: Any] = [:]) async -> Result<CloudChittyID, ChittyError> {
        guard isOnline else {
            return .failure(.networkUnavailable)
        }

        operationStatus = .processing

        do {
            // Request ID generation from cloud pipeline
            let cloudID = try await cloudAPI.requestIDFromPipeline(
                type: type.rawValue,
                metadata: metadata
            )

            // Add to recent IDs for UI display (memory only)
            recentIDs.insert(cloudID, at: 0)
            if recentIDs.count > 20 {
                recentIDs.removeLast()
            }

            operationStatus = .success
            return .success(cloudID)

        } catch {
            operationStatus = .error(error.localizedDescription)
            return .failure(.cloudOperationFailed(error.localizedDescription))
        }
    }

    // MARK: - Cloud Operations Only
    private func loadRecentCloudIDs() {
        Task {
            guard isOnline else { return }

            do {
                let recent = try await cloudAPI.getRecentIDs(limit: 20)
                await MainActor.run {
                    self.recentIDs = recent
                }
            } catch {
                print("Failed to load recent IDs: \(error)")
            }
        }
    }

    // MARK: - Validation (Cloud-Only)
    func validateID(_ chittyID: String) async -> ValidationResult {
        guard isOnline else {
            return ValidationResult(isValid: false, trustLevel: nil, error: "Network unavailable")
        }

        do {
            return try await cloudAPI.validateID(chittyID)
        } catch {
            return ValidationResult(isValid: false, trustLevel: nil, error: error.localizedDescription)
        }
    }

    // MARK: - Spotlight Integration (Cloud IDs Only)
    func indexForSpotlight(_ cloudID: CloudChittyID) {
        let searchableItem = CSSearchableItem(
            uniqueIdentifier: cloudID.id,
            domainIdentifier: "cc.chitty.ids",
            attributeSet: createSpotlightAttributes(for: cloudID)
        )

        CSSearchableIndex.default().indexSearchableItems([searchableItem]) { error in
            if let error = error {
                print("❌ Spotlight indexing failed: \(error)")
            }
        }
    }

    private func createSpotlightAttributes(for cloudID: CloudChittyID) -> CSSearchableItemAttributeSet {
        let attributes = CSSearchableItemAttributeSet(contentType: .data)

        attributes.title = "ChittyID: \(cloudID.id)"
        attributes.contentDescription = "ChittyOS Cloud Identity - Trust: \(Int(cloudID.trustLevel * 100))%"
        attributes.keywords = ["chittyos", "identity", "cloud"]
        attributes.creator = "ChittyOS"
        attributes.identifier = cloudID.id

        return attributes
    }

    // MARK: - Quick Look Integration (Mac Native)
    func generateQuickLookPreview(for chittyID: String) -> URL? {
        // Generate a preview file for Quick Look
        let tempDir = FileManager.default.temporaryDirectory
        let previewURL = tempDir.appendingPathComponent("\(chittyID)-preview.html")

        let htmlContent = generateIDPreviewHTML(chittyID)

        do {
            try htmlContent.write(to: previewURL, atomically: true, encoding: .utf8)
            return previewURL
        } catch {
            print("❌ Quick Look preview generation failed: \(error)")
            return nil
        }
    }

    private func generateIDPreviewHTML(_ chittyID: String) -> String {
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>ChittyID: \(chittyID)</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; }
                .header { color: #007AFF; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
                .info { margin: 20px 0; }
                .label { font-weight: bold; color: #333; }
                .value { color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🆔 ChittyID</h1>
                <p>\(chittyID)</p>
            </div>
            <div class="info">
                <p><span class="label">Status:</span> <span class="value">Verified</span></p>
                <p><span class="label">Created:</span> <span class="value">\(Date())</span></p>
                <p><span class="label">Trust Level:</span> <span class="value">High</span></p>
            </div>
        </body>
        </html>
        """
    }

    // MARK: - Notification Integration (Mac Native)
    func sendNotification(title: String, body: String, chittyID: String? = nil) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        if let chittyID = chittyID {
            content.userInfo = ["chittyID": chittyID]
        }

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("❌ Notification failed: \(error)")
            }
        }
    }

    // MARK: - Private Helpers

    private func setupNetworkMonitoring() {
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.isOnline = path.status == .satisfied
                if path.status == .satisfied {
                    self?.loadRecentCloudIDs()
                }
            }
        }
        let queue = DispatchQueue(label: "NetworkMonitor")
        monitor.start(queue: queue)
    }
}

// MARK: - Cloud API Integration
class ChittyCloudAPI {
    private let chittyIDURL = "https://id.chitty.cc"
    private let routerURL = "https://router.chitty.cc"
    private var authToken: String?

    func authenticate(token: String) {
        self.authToken = token
    }

    // Just send to router - router handles everything
    func requestIDFromPipeline(type: String, metadata: [String: Any]) async throws -> CloudChittyID {
        guard let token = authToken else {
            throw ChittyError.notAuthenticated
        }

        let request = [
            "action": "request-id",
            "type": type,
            "metadata": metadata,
            "source": "mac-native"
        ] as [String : Any]

        return try await sendToRouter(request)
    }

    func validateID(_ chittyID: String) async throws -> ValidationResult {
        let request = [
            "action": "validate-id",
            "id": chittyID
        ] as [String : Any]

        let data: CloudChittyID = try await sendToRouter(request)
        return ValidationResult(isValid: data.trustLevel > 0, trustLevel: data.trustLevel, error: nil)
    }

    func getRecentIDs(limit: Int = 20) async throws -> [CloudChittyID] {
        guard let token = authToken else {
            throw ChittyError.notAuthenticated
        }

        let request = [
            "action": "get-recent",
            "limit": limit
        ] as [String : Any]

        let response: [CloudChittyID] = try await sendToRouterArray(request)
        return response
    }

    // Single point of contact with router
    private func sendToRouter<T: Decodable>(_ payload: [String: Any]) async throws -> T {
        guard let token = authToken else {
            throw ChittyError.notAuthenticated
        }

        var request = URLRequest(url: URL(string: "\(routerURL)/api/route")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChittyError.pipelineError("Router request failed")
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    private func sendToRouterArray<T: Decodable>(_ payload: [String: Any]) async throws -> [T] {
        guard let token = authToken else {
            throw ChittyError.notAuthenticated
        }

        var request = URLRequest(url: URL(string: "\(routerURL)/api/route")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChittyError.pipelineError("Router request failed")
        }

        return try JSONDecoder().decode([T].self, from: data)
    }
}



// MARK: - Data Models

struct CloudChittyID: Codable {
    let id: String
    let trustLevel: Double
    let createdAt: Date
    let blockchain: BlockchainInfo?
}

struct BlockchainInfo: Codable {
    let txHash: String
    let blockNumber: Int
    let network: String
}

struct ValidationResult: Codable {
    let isValid: Bool
    let trustLevel: Double?
    let error: String?
}


enum ChittyError: Error {
    case notAuthenticated
    case pipelineError(String)
    case networkUnavailable
    case cloudOperationFailed(String)
    case validationFailed(String)
}

// MARK: - Extensions for IDType
extension ChittyIDService.IDType: Codable {
    var rawValue: String {
        switch self {
        case .person: return "person"
        case .document: return "document"
        case .project: return "project"
        case .evidence: return "evidence"
        case .asset: return "asset"
        }
    }
}

// MARK: - Core Spotlight Import
import CoreSpotlight
import UniformTypeIdentifiers
import UserNotifications